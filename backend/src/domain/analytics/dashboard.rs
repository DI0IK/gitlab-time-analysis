use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    db::groups::GroupRecord,
    domain::analytics::{
        comparison::GroupComparisonSummary,
        metrics::{
            CategoryDistribution, CategorySprintShift, DeadlineRushMetric, FairnessMetric,
            MemberMetric, MemberRoleSpecialization, SprintMetric, TimeOfDayHeatmap,
            UserCategoryMatrixRow, WeekdaySprintHeatmap,
        },
    },
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupDashboardResponse {
    pub group: GroupRecord,
    pub total_seconds: i64,
    pub total_hours: f64,
    pub estimated_seconds: i64,
    pub estimated_hours: f64,
    pub delta_hours: f64,
    pub accuracy_ratio: f64,
    pub fairness: FairnessMetric,
    pub members: Vec<MemberMetric>,
    pub categories: Vec<CategoryDistribution>,
    pub sprints: Vec<SprintMetric>,
    pub matrix: Vec<UserCategoryMatrixRow>,
    pub heatmap: WeekdaySprintHeatmap,
    pub time_of_day: TimeOfDayHeatmap,
    pub deadline_rush: DeadlineRushMetric,
    pub category_shift: Vec<CategorySprintShift>,
    pub role_specializations: Vec<MemberRoleSpecialization>,
    pub subgroups: Vec<GroupComparisonSummary>,
    pub peers: Vec<GroupComparisonSummary>,
    pub current_sprint: Option<i64>,
    pub default_sprint: Option<i64>,
}
