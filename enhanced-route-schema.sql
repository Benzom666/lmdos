-- Enhanced route schema to support advanced optimization features

-- Add optimization-related columns to driver_routes table
ALTER TABLE driver_routes 
ADD COLUMN IF NOT EXISTS optimization_metrics JSONB,
ADD COLUMN IF NOT EXISTS algorithm_used VARCHAR(50) DEFAULT 'advanced_multi_strategy';

-- Add optimization-related columns to route_stops table  
ALTER TABLE route_stops 
ADD COLUMN IF NOT EXISTS optimization_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS cluster_group INTEGER,
ADD COLUMN IF NOT EXISTS segment_distance DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS travel_time DECIMAL(6,2);

-- Create index for optimization queries
CREATE INDEX IF NOT EXISTS idx_route_stops_optimization 
ON route_stops(route_id, sequence, optimization_score);

-- Create index for cluster analysis
CREATE INDEX IF NOT EXISTS idx_route_stops_cluster 
ON route_stops(route_id, cluster_group, sequence);

-- Add comments for documentation
COMMENT ON COLUMN driver_routes.optimization_metrics IS 'JSON containing optimization algorithm results and metrics';
COMMENT ON COLUMN driver_routes.algorithm_used IS 'Name of the optimization algorithm used for this route';
COMMENT ON COLUMN route_stops.optimization_score IS 'Score (0-100) indicating how well this stop fits in the optimized route';
COMMENT ON COLUMN route_stops.cluster_group IS 'Cluster group number for stops that are geographically close';
COMMENT ON COLUMN route_stops.segment_distance IS 'Distance from previous stop in kilometers';
COMMENT ON COLUMN route_stops.travel_time IS 'Estimated travel time from previous stop in minutes';

-- Create function to calculate route efficiency metrics
CREATE OR REPLACE FUNCTION calculate_route_efficiency(route_id_param UUID)
RETURNS TABLE(
    total_distance DECIMAL(8,3),
    average_segment_distance DECIMAL(8,3),
    longest_segment DECIMAL(8,3),
    shortest_segment DECIMAL(8,3),
    clustering_score DECIMAL(8,3),
    efficiency_rating VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH route_segments AS (
        SELECT 
            estimated_distance,
            LAG(estimated_distance) OVER (ORDER BY sequence) as prev_distance
        FROM route_stops 
        WHERE route_id = route_id_param 
        AND status != 'cancelled'
        ORDER BY sequence
    ),
    segment_stats AS (
        SELECT 
            SUM(estimated_distance) as total_dist,
            AVG(estimated_distance) as avg_dist,
            MAX(estimated_distance) as max_dist,
            MIN(estimated_distance) as min_dist,
            STDDEV(estimated_distance) as std_dist
        FROM route_segments
        WHERE estimated_distance IS NOT NULL
    )
    SELECT 
        s.total_dist,
        s.avg_dist,
        s.max_dist,
        s.min_dist,
        CASE 
            WHEN s.std_dist IS NULL OR s.avg_dist = 0 THEN 0
            ELSE s.std_dist / s.avg_dist
        END as clustering_score,
        CASE 
            WHEN s.avg_dist < 3 THEN 'EXCELLENT'
            WHEN s.avg_dist < 5 THEN 'GOOD'
            WHEN s.avg_dist < 8 THEN 'FAIR'
            ELSE 'POOR'
        END as efficiency_rating
    FROM segment_stats s;
END;
$$ LANGUAGE plpgsql;

-- Create view for route optimization analysis
CREATE OR REPLACE VIEW route_optimization_summary AS
SELECT 
    dr.id as route_id,
    dr.driver_id,
    dr.shift_date,
    dr.total_distance,
    dr.total_time,
    dr.algorithm_used,
    COUNT(rs.id) as total_stops,
    COUNT(CASE WHEN rs.status = 'completed' THEN 1 END) as completed_stops,
    AVG(rs.optimization_score) as avg_optimization_score,
    AVG(rs.estimated_distance) as avg_segment_distance,
    MAX(rs.estimated_distance) as longest_segment,
    MIN(rs.estimated_distance) as shortest_segment,
    COUNT(DISTINCT rs.cluster_group) as cluster_count,
    dr.optimization_metrics
FROM driver_routes dr
LEFT JOIN route_stops rs ON dr.id = rs.route_id
WHERE dr.status = 'active'
GROUP BY dr.id, dr.driver_id, dr.shift_date, dr.total_distance, dr.total_time, 
         dr.algorithm_used, dr.optimization_metrics;

-- Add trigger to automatically update segment distances
CREATE OR REPLACE FUNCTION update_segment_distance()
RETURNS TRIGGER AS $$
DECLARE
    prev_coordinates JSONB;
    current_coordinates JSONB;
    distance_km DECIMAL(8,3);
BEGIN
    -- Get coordinates of previous stop
    SELECT coordinates INTO prev_coordinates
    FROM route_stops 
    WHERE route_id = NEW.route_id 
    AND sequence = NEW.sequence - 1;
    
    -- Calculate distance if previous stop exists
    IF prev_coordinates IS NOT NULL AND NEW.coordinates IS NOT NULL THEN
        -- Simple distance calculation (would be replaced with more accurate calculation)
        distance_km := SQRT(
            POWER(
                (NEW.coordinates->1)::DECIMAL - (prev_coordinates->1)::DECIMAL, 2
            ) + 
            POWER(
                (NEW.coordinates->0)::DECIMAL - (prev_coordinates->0)::DECIMAL, 2
            )
        ) * 111; -- Rough conversion to km
        
        NEW.segment_distance := distance_km;
        NEW.travel_time := distance_km * 1.5 + 10; -- Rough time estimate
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic segment distance calculation
DROP TRIGGER IF EXISTS trigger_update_segment_distance ON route_stops;
CREATE TRIGGER trigger_update_segment_distance
    BEFORE INSERT OR UPDATE ON route_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_segment_distance();

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_route_stops_coordinates 
ON route_stops USING GIN (coordinates);

CREATE INDEX IF NOT EXISTS idx_driver_routes_optimization 
ON driver_routes USING GIN (optimization_metrics);

CREATE INDEX IF NOT EXISTS idx_route_stops_performance 
ON route_stops(route_id, sequence, status, estimated_distance);

-- Add constraint to ensure optimization score is within valid range
ALTER TABLE route_stops 
ADD CONSTRAINT chk_optimization_score 
CHECK (optimization_score IS NULL OR (optimization_score >= 0 AND optimization_score <= 100));

-- Add constraint to ensure distances are positive
ALTER TABLE route_stops 
ADD CONSTRAINT chk_positive_distance 
CHECK (estimated_distance IS NULL OR estimated_distance >= 0);

-- Create materialized view for route analytics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS route_performance_analytics AS
SELECT 
    DATE_TRUNC('day', dr.created_at) as route_date,
    dr.algorithm_used,
    COUNT(*) as total_routes,
    AVG(dr.total_distance) as avg_total_distance,
    AVG(dr.total_time) as avg_total_time,
    AVG(COUNT(rs.id)) as avg_stops_per_route,
    AVG(AVG(rs.optimization_score)) as avg_optimization_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dr.total_distance) as median_distance,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY dr.total_distance) as p95_distance
FROM driver_routes dr
LEFT JOIN route_stops rs ON dr.id = rs.route_id
WHERE dr.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', dr.created_at), dr.algorithm_used
ORDER BY route_date DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_route_analytics_unique 
ON route_performance_analytics(route_date, algorithm_used);

-- Add helpful comments
COMMENT ON MATERIALIZED VIEW route_performance_analytics IS 'Performance analytics for route optimization algorithms over the last 30 days';
COMMENT ON FUNCTION calculate_route_efficiency IS 'Calculates efficiency metrics for a specific route including clustering and distance analysis';
COMMENT ON VIEW route_optimization_summary IS 'Summary view of active routes with optimization metrics and performance indicators';
