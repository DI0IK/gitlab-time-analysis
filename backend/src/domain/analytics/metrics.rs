use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::domain::categories::CategoryId;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MemberMetric {
    pub username: String,
    pub name: String,
    pub custom_display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub effort_multiplier: f64,
    pub work_items_count: usize,
    pub timelog_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CategoryDistribution {
    pub category_id: CategoryId,
    pub label: String,
    pub short_code: String,
    pub color: String,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SprintMetric {
    pub sprint_number: i64,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub cumulative_hours: f64,
    pub active_members: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FairnessMetric {
    pub mean_hours: f64,
    pub std_dev: f64,
    pub coefficient_of_variation: f64,
    pub rating: String,
    pub explanation: String,
}

impl FairnessMetric {
    pub fn calculate(member_hours: &[f64]) -> Self {
        if member_hours.is_empty() {
            return Self {
                mean_hours: 0.0,
                std_dev: 0.0,
                coefficient_of_variation: 0.0,
                rating: "Pending".to_string(),
                explanation: "No logged hours found yet.".to_string(),
            };
        }

        let n = member_hours.len() as f64;
        let sum: f64 = member_hours.iter().sum();
        let mean = sum / n;

        if mean == 0.0 {
            return Self {
                mean_hours: 0.0,
                std_dev: 0.0,
                coefficient_of_variation: 0.0,
                rating: "Balanced".to_string(),
                explanation: "Zero logged hours across all members.".to_string(),
            };
        }

        let variance = member_hours.iter().map(|h| (h - mean).powi(2)).sum::<f64>() / n;
        let std_dev = variance.sqrt();
        let cv = std_dev / mean;

        let (rating, explanation) = match cv {
            cv if cv <= 0.20 => (
                "Excellent".to_string(),
                "Workload is extremely evenly shared across the team.".to_string(),
            ),
            cv if cv <= 0.40 => (
                "Good".to_string(),
                "Healthy balance with normal specialization variation.".to_string(),
            ),
            cv if cv <= 0.65 => (
                "Moderate".to_string(),
                "Noticeable variance in hours; some members shoulder more effort.".to_string(),
            ),
            _ => (
                "Imbalanced".to_string(),
                "High effort disparity between team members.".to_string(),
            ),
        };

        Self {
            mean_hours: (mean * 10.0).round() / 10.0,
            std_dev: (std_dev * 10.0).round() / 10.0,
            coefficient_of_variation: (cv * 100.0).round() / 100.0,
            rating,
            explanation,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserCategoryMatrixRow {
    pub username: String,
    pub name: String,
    pub custom_display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub sprint_number: Option<i64>,
    pub pm_hours: f64,
    pub re_hours: f64,
    pub impl_hours: f64,
    pub arch_hours: f64,
    pub other_hours: f64,
    pub total_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WeekdayHeatmapCell {
    pub sprint_number: i64,
    pub weekday: u32,
    pub weekday_name: String,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub timelog_count: usize,
    #[serde(default)]
    pub is_current_day: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WeekdaySprintHeatmap {
    pub cells: Vec<WeekdayHeatmapCell>,
    pub max_hours: f64,
    pub total_hours: f64,
    pub sprint_numbers: Vec<i64>,
    pub sprint_start_weekday: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TimeOfDayCell {
    pub weekday: u32,
    pub weekday_name: String,
    pub hour: u32,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub timelog_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TimeBlockSummary {
    pub name: String,
    pub hours: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TimeOfDayHeatmap {
    pub cells: Vec<TimeOfDayCell>,
    pub max_hours: f64,
    pub total_hours: f64,
    pub peak_hour: u32,
    pub peak_hour_hours: f64,
    pub core_hours_pct: f64,
    pub night_owl_pct: f64,
    pub time_blocks: Vec<TimeBlockSummary>,
    pub hourly_totals: Vec<f64>,
    pub excluded_date_only_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SprintDeadlineRush {
    pub sprint_number: i64,
    pub rush_hours: f64,
    pub total_hours: f64,
    pub rush_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DeadlineRushMetric {
    pub overall_rush_hours: f64,
    pub overall_total_hours: f64,
    pub rush_percentage: f64,
    pub rating: String,
    pub explanation: String,
    pub sprints: Vec<SprintDeadlineRush>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CategorySprintShift {
    pub sprint_number: i64,
    pub pm_hours: f64,
    pub re_hours: f64,
    pub impl_hours: f64,
    pub arch_hours: f64,
    pub other_hours: f64,
    pub total_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MemberRoleSpecialization {
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub pm_percentage: f64,
    pub re_percentage: f64,
    pub impl_percentage: f64,
    pub arch_percentage: f64,
    pub other_percentage: f64,
    pub primary_role: String,
    pub total_hours: f64,
}
