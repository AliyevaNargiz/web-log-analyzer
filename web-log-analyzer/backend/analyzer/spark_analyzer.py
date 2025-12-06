"""Apache Spark analysis jobs for web log processing with optimized performance."""

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, TimestampType
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
import json
import os
import logging
import threading

from django.conf import settings

logger = logging.getLogger(__name__)

# Schema for log entries
LOG_SCHEMA = StructType([
    StructField("ip", StringType(), True),
    StructField("timestamp", TimestampType(), True),
    StructField("method", StringType(), True),
    StructField("path", StringType(), True),
    StructField("protocol", StringType(), True),
    StructField("status", IntegerType(), True),
    StructField("size", IntegerType(), True),
])


class SparkSessionManager:
    """Singleton manager for SparkSession to reuse across requests."""
    
    _instance = None
    _lock = threading.Lock()
    _spark = None
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(SparkSessionManager, cls).__new__(cls)
        return cls._instance
    
    def get_or_create_spark(self) -> SparkSession:
        """Get or create Spark session with optimized configuration."""
        if self._spark is None:
            with self._lock:
                if self._spark is None:
                    try:
                        # Optimized Spark configuration for log analysis
                        spark_builder = SparkSession.builder \
                            .appName(settings.SPARK_APP_NAME) \
                            .master(settings.SPARK_MASTER)
                        
                        # Memory and performance optimizations
                        spark_builder = spark_builder \
                            .config("spark.driver.memory", "4g") \
                            .config("spark.executor.memory", "4g") \
                            .config("spark.driver.maxResultSize", "2g") \
                            .config("spark.sql.shuffle.partitions", "200") \
                            .config("spark.sql.adaptive.enabled", "true") \
                            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
                            .config("spark.sql.adaptive.skewJoin.enabled", "true") \
                            .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
                            .config("spark.sql.execution.arrow.pyspark.enabled", "true") \
                            .config("spark.sql.execution.arrow.maxRecordsPerBatch", "10000") \
                            .config("spark.sql.files.maxPartitionBytes", "134217728") \
                            .config("spark.sql.files.openCostInBytes", "4194304") \
                            .config("spark.default.parallelism", "8")
                        
                        self._spark = spark_builder.getOrCreate()
                        
                        # Set log level to reduce noise
                        self._spark.sparkContext.setLogLevel("WARN")
                        
                        logger.info("Spark session created successfully")
                    except Exception as e:
                        logger.error(f"Failed to create Spark session: {str(e)}", exc_info=True)
                        raise
        
        return self._spark
    
    def stop(self):
        """Stop Spark session."""
        if self._spark is not None:
            with self._lock:
                if self._spark is not None:
                    try:
                        self._spark.stop()
                        logger.info("Spark session stopped")
                    except Exception as e:
                        logger.error(f"Error stopping Spark session: {str(e)}")
                    finally:
                        self._spark = None


class SparkLogAnalyzer:
    """Optimized Spark-based log analyzer for large-scale processing."""
    
    def __init__(self):
        self.session_manager = SparkSessionManager()
        self.spark = None
    
    def _get_spark(self) -> SparkSession:
        """Get Spark session."""
        if self.spark is None:
            self.spark = self.session_manager.get_or_create_spark()
        return self.spark
    
    def create_dataframe(self, entries: List[Dict[str, Any]]):
        """Create Spark DataFrame from log entries with optimized schema."""
        spark = self._get_spark()
        
        # Convert entries to Spark-compatible format
        data = []
        for entry in entries:
            timestamp = None
            if entry.get('timestamp'):
                try:
                    if isinstance(entry['timestamp'], str):
                        # Handle ISO format and Apache format
                        timestamp_str = entry['timestamp'].replace('Z', '+00:00')
                        timestamp = datetime.fromisoformat(timestamp_str)
                    elif isinstance(entry['timestamp'], datetime):
                        timestamp = entry['timestamp']
                except (ValueError, TypeError) as e:
                    logger.debug(f"Failed to parse timestamp: {entry.get('timestamp')}, error: {e}")
                    pass
            
            data.append((
                entry.get('ip', 'unknown'),
                timestamp,
                entry.get('method', 'GET'),
                entry.get('path', '/'),
                entry.get('protocol', 'HTTP/1.1'),
                entry.get('status', 0),
                entry.get('size', 0),
            ))
        
        if not data:
            # Return empty DataFrame with schema
            return spark.createDataFrame([], LOG_SCHEMA)
        
        # Create DataFrame with optimized partitioning
        df = spark.createDataFrame(data, LOG_SCHEMA)
        
        # Repartition for better performance on large datasets
        num_partitions = min(200, max(1, len(data) // 10000))
        if num_partitions > 1:
            df = df.repartition(num_partitions)
        
        return df
    
    def apply_filters(self, df, filters: Dict[str, Any]):
        """Apply filters to DataFrame with pushdown optimization."""
        if not filters:
            return df
        
        filter_count = 0
        
        # Date range filter - pushdown to Spark
        date_range = filters.get('dateRange', {})
        if date_range.get('start'):
            try:
                start_dt = datetime.fromisoformat(date_range['start'])
                df = df.filter(F.col('timestamp') >= F.lit(start_dt))
                filter_count += 1
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid start date filter: {date_range['start']}, error: {e}")
        
        if date_range.get('end'):
            try:
                end_dt = datetime.fromisoformat(date_range['end'])
                df = df.filter(F.col('timestamp') <= F.lit(end_dt))
                filter_count += 1
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid end date filter: {date_range['end']}, error: {e}")
        
        # IP address filter - optimized with contains
        ip_pattern = filters.get('ipAddress', '').strip()
        if ip_pattern:
            df = df.filter(F.col('ip').contains(ip_pattern))
            filter_count += 1
        
        # URL pattern filter
        url_pattern = filters.get('urlPattern', '').strip()
        if url_pattern:
            df = df.filter(F.col('path').contains(url_pattern))
            filter_count += 1
        
        # Status codes filter - optimized with isin
        status_codes = filters.get('statusCodes', [])
        if status_codes:
            # Handle both exact codes and code groups (200, 300, 400, 500)
            conditions = []
            exact_codes = []
            for code in status_codes:
                if isinstance(code, int) and code in [200, 300, 400, 500]:
                    # It's a group code, match the range
                    conditions.append(
                        (F.col('status') >= code) & (F.col('status') < code + 100)
                    )
                else:
                    exact_codes.append(code)
            
            if exact_codes:
                conditions.append(F.col('status').isin(exact_codes))
            
            if conditions:
                combined = conditions[0]
                for cond in conditions[1:]:
                    combined = combined | cond
                df = df.filter(combined)
                filter_count += 1
        
        # HTTP methods filter - optimized with isin
        methods = filters.get('httpMethods', [])
        if methods:
            df = df.filter(F.col('method').isin(methods))
            filter_count += 1
        
        # Size range filter
        size_range = filters.get('sizeRange', {})
        if size_range.get('min'):
            try:
                min_size = int(size_range['min'])
                df = df.filter(F.col('size') >= min_size)
                filter_count += 1
            except (ValueError, TypeError):
                pass
        
        if size_range.get('max'):
            try:
                max_size = int(size_range['max'])
                df = df.filter(F.col('size') <= max_size)
                filter_count += 1
            except (ValueError, TypeError):
                pass
        
        logger.debug(f"Applied {filter_count} filters to DataFrame")
        return df
    
    def unique_ip_counter(self, df) -> Dict[str, Any]:
        """P1: Count unique IP addresses and rank by frequency - optimized."""
        # Count distinct IPs efficiently
        unique_count = df.select('ip').distinct().count()
        
        # Top IPs by request count - optimized aggregation
        top_ips = df.groupBy('ip') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .limit(10) \
            .collect()
        
        return {
            'count': unique_count,
            'topIps': [{'ip': row['ip'], 'count': row['count']} for row in top_ips]
        }
    
    def top_pages_counter(self, df) -> List[Dict[str, Any]]:
        """P2: Count top requested pages - optimized."""
        top_pages = df.groupBy('path') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .limit(20) \
            .collect()
        
        return [{'path': row['path'], 'count': row['count']} for row in top_pages]
    
    def hourly_traffic_counter(self, df) -> List[Dict[str, Any]]:
        """P3: Count traffic by hour of day - optimized with time functions."""
        # Extract hour from timestamp efficiently
        hourly = df.filter(F.col('timestamp').isNotNull()) \
            .withColumn('hour', F.hour('timestamp')) \
            .groupBy('hour') \
            .agg(F.count('*').alias('count')) \
            .orderBy('hour') \
            .collect()
        
        # Create full 24-hour result
        hour_counts = {row['hour']: row['count'] for row in hourly}
        return [{'hour': h, 'count': hour_counts.get(h, 0)} for h in range(24)]
    
    def status_code_distribution(self, df) -> List[Dict[str, Any]]:
        """P4: Distribution of HTTP status codes - optimized."""
        status_dist = df.groupBy('status') \
            .agg(F.count('*').alias('count')) \
            .orderBy('status') \
            .collect()
        
        return [{'status': row['status'], 'count': row['count']} for row in status_dist]
    
    def bandwidth_aggregator(self, df) -> Dict[str, Any]:
        """P5: Aggregate bandwidth usage - optimized with aggregations."""
        # Total and average size in single pass
        size_stats = df.agg(
            F.sum('size').alias('total'),
            F.avg('size').alias('avg'),
            F.count('*').alias('count')
        ).collect()[0]
        
        total_bytes = int(size_stats['total'] or 0)
        avg_size = float(size_stats['avg'] or 0)
        
        # Top paths by bandwidth - optimized
        top_paths = df.groupBy('path') \
            .agg(F.sum('size').alias('bytes')) \
            .orderBy(F.desc('bytes')) \
            .limit(10) \
            .collect()
        
        return {
            'totalBytes': total_bytes,
            'avgSize': avg_size,
            'byPath': [{'path': row['path'], 'bytes': int(row['bytes'])} for row in top_paths]
        }
    
    def http_method_distribution(self, df) -> List[Dict[str, Any]]:
        """P6: Distribution of HTTP methods (GET, POST, etc.)."""
        method_dist = df.groupBy('method') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .collect()
        
        return [{'method': row['method'], 'count': row['count']} for row in method_dist]
    
    def daily_traffic_counter(self, df) -> List[Dict[str, Any]]:
        """P7: Count traffic by day of week."""
        # Extract day of week from timestamp (0=Monday, 6=Sunday)
        daily = df.filter(F.col('timestamp').isNotNull()) \
            .withColumn('dayOfWeek', F.dayofweek('timestamp')) \
            .groupBy('dayOfWeek') \
            .agg(F.count('*').alias('count')) \
            .orderBy('dayOfWeek') \
            .collect()
        
        # Create full week result (Spark uses 1=Sunday, 7=Saturday)
        day_counts = {row['dayOfWeek']: row['count'] for row in daily}
        day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return [{'day': day_names[i], 'dayOfWeek': i + 1, 'count': day_counts.get(i + 1, 0)} for i in range(7)]
    
    def error_rate_analysis(self, df) -> Dict[str, Any]:
        """P8: Analyze error rates (4xx and 5xx status codes)."""
        total_requests = df.count()
        
        # Count errors by category
        error_stats = df.agg(
            F.sum(F.when((F.col('status') >= 400) & (F.col('status') < 500), 1).otherwise(0)).alias('client_errors'),
            F.sum(F.when(F.col('status') >= 500, 1).otherwise(0)).alias('server_errors'),
            F.sum(F.when((F.col('status') >= 200) & (F.col('status') < 300), 1).otherwise(0)).alias('success'),
            F.sum(F.when((F.col('status') >= 300) & (F.col('status') < 400), 1).otherwise(0)).alias('redirects')
        ).collect()[0]
        
        client_errors = int(error_stats['client_errors'] or 0)
        server_errors = int(error_stats['server_errors'] or 0)
        success = int(error_stats['success'] or 0)
        redirects = int(error_stats['redirects'] or 0)
        
        # Top error status codes
        top_errors = df.filter(F.col('status') >= 400) \
            .groupBy('status') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .limit(10) \
            .collect()
        
        return {
            'totalRequests': total_requests,
            'clientErrors': client_errors,
            'serverErrors': server_errors,
            'success': success,
            'redirects': redirects,
            'clientErrorRate': (client_errors / total_requests * 100) if total_requests > 0 else 0,
            'serverErrorRate': (server_errors / total_requests * 100) if total_requests > 0 else 0,
            'successRate': (success / total_requests * 100) if total_requests > 0 else 0,
            'topErrors': [{'status': row['status'], 'count': row['count']} for row in top_errors]
        }
    
    def response_size_distribution(self, df) -> Dict[str, Any]:
        """P9: Distribution of response sizes."""
        size_stats = df.agg(
            F.min('size').alias('min'),
            F.max('size').alias('max'),
            F.avg('size').alias('avg'),
            F.percentile_approx('size', 0.5).alias('median'),
            F.percentile_approx('size', 0.95).alias('p95'),
            F.percentile_approx('size', 0.99).alias('p99')
        ).collect()[0]
        
        # Size buckets for distribution
        size_buckets = [
            (0, 1024, '0-1KB'),
            (1024, 10240, '1-10KB'),
            (10240, 102400, '10-100KB'),
            (102400, 1048576, '100KB-1MB'),
            (1048576, float('inf'), '1MB+')
        ]
        
        bucket_counts = []
        for min_size, max_size, label in size_buckets:
            if max_size == float('inf'):
                count = df.filter(F.col('size') >= min_size).count()
            else:
                count = df.filter((F.col('size') >= min_size) & (F.col('size') < max_size)).count()
            bucket_counts.append({'range': label, 'count': count})
        
        return {
            'min': int(size_stats['min'] or 0),
            'max': int(size_stats['max'] or 0),
            'avg': float(size_stats['avg'] or 0),
            'median': float(size_stats['median'] or 0) if size_stats['median'] else 0,
            'p95': float(size_stats['p95'] or 0) if size_stats['p95'] else 0,
            'p99': float(size_stats['p99'] or 0) if size_stats['p99'] else 0,
            'distribution': bucket_counts
        }
    
    def protocol_version_analysis(self, df) -> List[Dict[str, Any]]:
        """P10: Analyze HTTP protocol versions."""
        protocol_dist = df.groupBy('protocol') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .collect()
        
        return [{'protocol': row['protocol'], 'count': row['count']} for row in protocol_dist]
    
    def peak_traffic_analysis(self, df) -> Dict[str, Any]:
        """P11: Identify peak traffic periods."""
        # Peak hours
        hourly = df.filter(F.col('timestamp').isNotNull()) \
            .withColumn('hour', F.hour('timestamp')) \
            .groupBy('hour') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .limit(5) \
            .collect()
        
        # Peak days of week
        daily = df.filter(F.col('timestamp').isNotNull()) \
            .withColumn('dayOfWeek', F.dayofweek('timestamp')) \
            .groupBy('dayOfWeek') \
            .agg(F.count('*').alias('count')) \
            .orderBy(F.desc('count')) \
            .limit(3) \
            .collect()
        
        day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        
        return {
            'peakHours': [{'hour': row['hour'], 'count': row['count']} for row in hourly],
            'peakDays': [{'day': day_names[row['dayOfWeek'] - 1], 'dayOfWeek': row['dayOfWeek'], 'count': row['count']} for row in daily]
        }
    
    def run_analyses(
        self,
        entries: List[Dict[str, Any]],
        selected_analyses: List[str],
        filters: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> Dict[str, Any]:
        """Run selected analyses on log entries with optimized Spark operations."""
        
        try:
            # Create DataFrame
            if progress_callback:
                progress_callback(5)
            
            df = self.create_dataframe(entries)
            original_count = df.count()
            
            if progress_callback:
                progress_callback(10)
            
            # Apply filters
            if filters:
                df = self.apply_filters(df, filters)
            
            filtered_count = df.count()
            
            if progress_callback:
                progress_callback(20)
            
            # Cache filtered DataFrame for multiple analyses
            df.cache()
            
            results = {
                'timestamp': datetime.now().isoformat(),
                'totalRecords': original_count,
                'filteredRecords': filtered_count,
                'analyses': {}
            }
            
            analysis_map = {
                'unique-ips': ('uniqueIps', self.unique_ip_counter),
                'top-pages': ('topPages', self.top_pages_counter),
                'hourly-traffic': ('hourlyTraffic', self.hourly_traffic_counter),
                'status-codes': ('statusCodes', self.status_code_distribution),
                'bandwidth': ('bandwidth', self.bandwidth_aggregator),
                'http-methods': ('httpMethods', self.http_method_distribution),
                'daily-traffic': ('dailyTraffic', self.daily_traffic_counter),
                'error-rate': ('errorRate', self.error_rate_analysis),
                'response-size': ('responseSize', self.response_size_distribution),
                'protocol-version': ('protocolVersion', self.protocol_version_analysis),
                'peak-traffic': ('peakTraffic', self.peak_traffic_analysis),
            }
            
            total = len(selected_analyses)
            base_progress = 20
            progress_per_analysis = (80 - base_progress) / total if total > 0 else 0
            
            for i, analysis_id in enumerate(selected_analyses):
                if analysis_id in analysis_map:
                    key, func = analysis_map[analysis_id]
                    try:
                        results['analyses'][key] = func(df)
                        
                        if progress_callback:
                            progress = base_progress + int((i + 1) * progress_per_analysis)
                            progress_callback(progress)
                    except Exception as e:
                        logger.error(f"Error in analysis {analysis_id}: {str(e)}", exc_info=True)
                        results['analyses'][key] = {'error': str(e)}
            
            # Uncache and cleanup
            df.unpersist()
            
            if progress_callback:
                progress_callback(100)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in run_analyses: {str(e)}", exc_info=True)
            raise
    
    def stop(self):
        """Stop Spark session (session is managed globally, so this is a no-op)."""
        # Session is managed globally, so we don't stop it here
        # It will be reused for subsequent requests
        pass


def save_results_to_csv(results: Dict[str, Any], job_id: str) -> Dict[str, str]:
    """Save analysis results to CSV files with optimized writing."""
    csv_paths = {}
    results_dir = settings.RESULTS_DIR / str(job_id)
    results_dir.mkdir(parents=True, exist_ok=True)
    
    analyses = results.get('analyses', {})
    
    # For small result sets, manual writing is faster and simpler
    # For large datasets, we could use Spark, but results are typically small
    
    # Unique IPs
    if 'uniqueIps' in analyses and 'topIps' in analyses['uniqueIps']:
        path = results_dir / 'unique_ips.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('ip,count\n')
            for item in analyses['uniqueIps']['topIps']:
                # Escape commas in IP if needed
                f.write(f"{item['ip']},{item['count']}\n")
        csv_paths['uniqueIps'] = str(path)
    
    # Top Pages
    if 'topPages' in analyses:
        path = results_dir / 'top_pages.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('path,count\n')
            for item in analyses['topPages']:
                # Properly escape paths with commas/quotes
                path_str = str(item['path']).replace('"', '""')
                f.write(f'"{path_str}",{item["count"]}\n')
        csv_paths['topPages'] = str(path)
    
    # Hourly Traffic
    if 'hourlyTraffic' in analyses:
        path = results_dir / 'hourly_traffic.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('hour,count\n')
            for item in analyses['hourlyTraffic']:
                f.write(f"{item['hour']},{item['count']}\n")
        csv_paths['hourlyTraffic'] = str(path)
    
    # Status Codes
    if 'statusCodes' in analyses:
        path = results_dir / 'status_codes.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('status,count\n')
            for item in analyses['statusCodes']:
                f.write(f"{item['status']},{item['count']}\n")
        csv_paths['statusCodes'] = str(path)
    
    # Bandwidth
    if 'bandwidth' in analyses and 'byPath' in analyses['bandwidth']:
        path = results_dir / 'bandwidth.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('path,bytes\n')
            for item in analyses['bandwidth']['byPath']:
                path_str = str(item['path']).replace('"', '""')
                f.write(f'"{path_str}",{item["bytes"]}\n')
        csv_paths['bandwidth'] = str(path)
    
    # HTTP Methods
    if 'httpMethods' in analyses:
        path = results_dir / 'http_methods.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('method,count\n')
            for item in analyses['httpMethods']:
                f.write(f"{item['method']},{item['count']}\n")
        csv_paths['httpMethods'] = str(path)
    
    # Daily Traffic
    if 'dailyTraffic' in analyses:
        path = results_dir / 'daily_traffic.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('day,dayOfWeek,count\n')
            for item in analyses['dailyTraffic']:
                f.write(f'"{item["day"]}",{item["dayOfWeek"]},{item["count"]}\n')
        csv_paths['dailyTraffic'] = str(path)
    
    # Error Rate
    if 'errorRate' in analyses:
        path = results_dir / 'error_rate.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('metric,value\n')
            error_data = analyses['errorRate']
            f.write(f"totalRequests,{error_data.get('totalRequests', 0)}\n")
            f.write(f"clientErrors,{error_data.get('clientErrors', 0)}\n")
            f.write(f"serverErrors,{error_data.get('serverErrors', 0)}\n")
            f.write(f"success,{error_data.get('success', 0)}\n")
            f.write(f"redirects,{error_data.get('redirects', 0)}\n")
            f.write(f"clientErrorRate,{error_data.get('clientErrorRate', 0):.2f}\n")
            f.write(f"serverErrorRate,{error_data.get('serverErrorRate', 0):.2f}\n")
            f.write(f"successRate,{error_data.get('successRate', 0):.2f}\n")
        csv_paths['errorRate'] = str(path)
        
        # Top Errors
        if 'topErrors' in error_data:
            path = results_dir / 'top_errors.csv'
            with open(path, 'w', encoding='utf-8') as f:
                f.write('status,count\n')
                for item in error_data['topErrors']:
                    f.write(f"{item['status']},{item['count']}\n")
            csv_paths['topErrors'] = str(path)
    
    # Response Size
    if 'responseSize' in analyses:
        path = results_dir / 'response_size.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('metric,value\n')
            size_data = analyses['responseSize']
            f.write(f"min,{size_data.get('min', 0)}\n")
            f.write(f"max,{size_data.get('max', 0)}\n")
            f.write(f"avg,{size_data.get('avg', 0):.2f}\n")
            f.write(f"median,{size_data.get('median', 0):.2f}\n")
            f.write(f"p95,{size_data.get('p95', 0):.2f}\n")
            f.write(f"p99,{size_data.get('p99', 0):.2f}\n")
        csv_paths['responseSize'] = str(path)
        
        # Size Distribution
        if 'distribution' in size_data:
            path = results_dir / 'size_distribution.csv'
            with open(path, 'w', encoding='utf-8') as f:
                f.write('range,count\n')
                for item in size_data['distribution']:
                    f.write(f'"{item["range"]}",{item["count"]}\n')
            csv_paths['sizeDistribution'] = str(path)
    
    # Protocol Version
    if 'protocolVersion' in analyses:
        path = results_dir / 'protocol_version.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('protocol,count\n')
            for item in analyses['protocolVersion']:
                protocol_str = str(item['protocol']).replace('"', '""')
                f.write(f'"{protocol_str}",{item["count"]}\n')
        csv_paths['protocolVersion'] = str(path)
    
    # Peak Traffic
    if 'peakTraffic' in analyses:
        path = results_dir / 'peak_traffic.csv'
        with open(path, 'w', encoding='utf-8') as f:
            f.write('type,value,count\n')
            peak_data = analyses['peakTraffic']
            for item in peak_data.get('peakHours', []):
                f.write(f"hour,{item['hour']},{item['count']}\n")
            for item in peak_data.get('peakDays', []):
                f.write(f'day,"{item["day"]}",{item["count"]}\n')
        csv_paths['peakTraffic'] = str(path)
    
    # Save full results as JSON
    json_path = results_dir / 'results.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, default=str)
    csv_paths['json'] = str(json_path)
    
    return csv_paths


