use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::domain::analytics::metrics::{CategoryDistribution, FairnessMetric};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupComparisonSummary {
    pub group_id: String,
    pub slug: String,
    pub name: String,
    pub level: i64,
    pub member_count: usize,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub estimated_hours: f64,
    pub accuracy_ratio: f64,
    pub fairness: FairnessMetric,
    pub categories: Vec<CategoryDistribution>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ComparisonResponse {
    pub total_cohort_seconds: i64,
    pub total_cohort_hours: f64,
    pub average_group_hours: f64,
    pub cohort_fairness: FairnessMetric,
    pub groups: Vec<GroupComparisonSummary>,
}
