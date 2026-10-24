use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum CategoryId {
    ProjectManagement,
    RequirementsEngineering,
    Implementation,
    Architecture,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CategoryMeta {
    pub id: String,
    pub label: String,
    pub short_code: String,
    pub color: String,
    pub description: String,
}

impl CategoryId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ProjectManagement => "project-management",
            Self::RequirementsEngineering => "requirements-engineering",
            Self::Implementation => "implementation",
            Self::Architecture => "architecture",
            Self::Other => "other",
        }
    }

    pub fn match_label(label: &str) -> Self {
        let lower = label.to_lowercase();
        // Scoped label extraction: e.g. 'type::pm' -> 'pm', 'category:project-management' -> 'project-management'
        let sublabel = if let Some((_, val)) = lower.rsplit_once("::") {
            val.trim()
        } else if let Some((_, val)) = lower.rsplit_once(':') {
            val.trim()
        } else {
            lower.trim()
        };

        // Priority evaluation according to taxonomy specification:
        // PM -> RE -> Implementation -> Architecture -> Other

        // 1. Project Management: /pm\b/, /project/, /management/, /projekt/
        if sublabel == "pm"
            || sublabel.starts_with("pm ")
            || sublabel.ends_with(" pm")
            || sublabel.contains(" pm ")
            || sublabel.contains("-pm")
            || sublabel.contains("_pm")
            || lower.contains("project")
            || lower.contains("projekt")
            || lower.contains("management")
            || lower.ends_with("::pm")
            || lower.ends_with(":pm")
        {
            Self::ProjectManagement
        } else if sublabel == "re"
            || sublabel.starts_with("re ")
            || sublabel.ends_with(" re")
            || sublabel.contains(" re ")
            || sublabel.contains("-re")
            || sublabel.contains("_re")
            || lower.contains("requirement")
            || lower.contains("anforder")
            || lower.contains("req")
            || lower.ends_with("::re")
            || lower.ends_with(":re")
        {
            Self::RequirementsEngineering
        } else if sublabel == "impl"
            || sublabel == "dev"
            || lower.contains("implement")
            || lower.contains("dev")
            || lower.contains("entwickl")
            || lower.contains("test")
            || lower.contains("coding")
            || lower.ends_with("::impl")
            || lower.ends_with("::dev")
        {
            Self::Implementation
        } else if sublabel == "arch"
            || lower.contains("arch")
            || lower.contains("entwurf")
            || lower.ends_with("::arch")
        {
            Self::Architecture
        } else {
            Self::Other
        }
    }
}

pub fn all_categories() -> Vec<CategoryMeta> {
    vec![
        CategoryMeta {
            id: CategoryId::ProjectManagement.as_str().to_string(),
            label: "Project Management".to_string(),
            short_code: "PM".to_string(),
            color: "#ff7300".to_string(),
            description: "Planning, coordination, meetings, organization, and project overhead"
                .to_string(),
        },
        CategoryMeta {
            id: CategoryId::RequirementsEngineering.as_str().to_string(),
            label: "Requirements Engineering".to_string(),
            short_code: "RE".to_string(),
            color: "#8884d8".to_string(),
            description: "User stories, specification, acceptance criteria, and domain modeling"
                .to_string(),
        },
        CategoryMeta {
            id: CategoryId::Implementation.as_str().to_string(),
            label: "Implementation".to_string(),
            short_code: "Impl".to_string(),
            color: "#82ca9d".to_string(),
            description: "Feature development, bug fixes, refactoring, tests, and writing code"
                .to_string(),
        },
        CategoryMeta {
            id: CategoryId::Architecture.as_str().to_string(),
            label: "Architecture".to_string(),
            short_code: "Arch".to_string(),
            color: "#ffc658".to_string(),
            description: "System design, technology evaluation, interfaces, and technical spikes"
                .to_string(),
        },
        CategoryMeta {
            id: CategoryId::Other.as_str().to_string(),
            label: "Other".to_string(),
            short_code: "Other".to_string(),
            color: "#94a3b8".to_string(),
            description: "Uncategorized tasks and general effort".to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_label_scoped_pm() {
        assert_eq!(
            CategoryId::match_label("type::pm"),
            CategoryId::ProjectManagement
        );
        assert_eq!(
            CategoryId::match_label("category::project-management"),
            CategoryId::ProjectManagement
        );
        assert_eq!(
            CategoryId::match_label("Projektmanagement"),
            CategoryId::ProjectManagement
        );
        assert_eq!(CategoryId::match_label("PM"), CategoryId::ProjectManagement);
    }

    #[test]
    fn test_match_label_scoped_re() {
        assert_eq!(
            CategoryId::match_label("type::requirements"),
            CategoryId::RequirementsEngineering
        );
        assert_eq!(
            CategoryId::match_label("type::re"),
            CategoryId::RequirementsEngineering
        );
        assert_eq!(
            CategoryId::match_label("Requirements Engineering"),
            CategoryId::RequirementsEngineering
        );
        assert_eq!(
            CategoryId::match_label("Anforderungen"),
            CategoryId::RequirementsEngineering
        );
    }

    #[test]
    fn test_match_label_scoped_impl() {
        assert_eq!(
            CategoryId::match_label("type::impl"),
            CategoryId::Implementation
        );
        assert_eq!(
            CategoryId::match_label("Implementierung"),
            CategoryId::Implementation
        );
        assert_eq!(
            CategoryId::match_label("Tests & CI/CD"),
            CategoryId::Implementation
        );
    }

    #[test]
    fn test_match_label_scoped_arch() {
        assert_eq!(
            CategoryId::match_label("type::arch"),
            CategoryId::Architecture
        );
        assert_eq!(
            CategoryId::match_label("Architektur & Design"),
            CategoryId::Architecture
        );
    }

    #[test]
    fn test_match_label_other() {
        assert_eq!(
            CategoryId::match_label("Priority::middle"),
            CategoryId::Other
        );
        assert_eq!(CategoryId::match_label("external"), CategoryId::Other);
    }
}
