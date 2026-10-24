use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Bronze,
    Silver,
    Gold,
    Legend,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TierMeta {
    pub id: String,
    pub name: String,
    pub min_level: u32,
    pub max_level: Option<u32>,
    pub color_hex: String,
    pub xp_per_level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LevelProgress {
    pub level: u32,
    pub tier: Tier,
    pub tier_name: String,
    pub tier_color: String,
    pub current_xp: u64,
    pub current_level_xp: u64,
    pub next_level_xp: u64,
    pub progress_pct: f32,
}

pub fn all_tiers() -> Vec<TierMeta> {
    vec![
        TierMeta {
            id: "bronze".to_string(),
            name: "Bronze".to_string(),
            min_level: 1,
            max_level: Some(9),
            color_hex: "#cd7f32".to_string(),
            xp_per_level: 200,
        },
        TierMeta {
            id: "silver".to_string(),
            name: "Silver".to_string(),
            min_level: 10,
            max_level: Some(19),
            color_hex: "#c0c0c0".to_string(),
            xp_per_level: 300,
        },
        TierMeta {
            id: "gold".to_string(),
            name: "Gold".to_string(),
            min_level: 20,
            max_level: Some(29),
            color_hex: "#ffd700".to_string(),
            xp_per_level: 400,
        },
        TierMeta {
            id: "legend".to_string(),
            name: "Legend".to_string(),
            min_level: 30,
            max_level: None,
            color_hex: "#a855f7".to_string(),
            xp_per_level: 500,
        },
    ]
}

/// Calculate the cumulative XP required to reach a specific level.
pub fn xp_needed_for_level(target_level: u32) -> u64 {
    if target_level <= 1 {
        return 0;
    }

    let mut total_xp = 0u64;
    for lvl in 1..target_level {
        let tier_xp = if lvl < 10 {
            200
        } else if lvl < 20 {
            300
        } else if lvl < 30 {
            400
        } else {
            500
        };
        total_xp += tier_xp;
    }
    total_xp
}

/// Calculate the user's level and tier progress given total accumulated XP.
pub fn calculate_level(total_xp: u64) -> LevelProgress {
    let mut current_level = 1u32;

    loop {
        let xp_for_next = xp_needed_for_level(current_level + 1);
        if total_xp < xp_for_next {
            break;
        }
        current_level += 1;
    }

    let current_level_base_xp = xp_needed_for_level(current_level);
    let next_level_base_xp = xp_needed_for_level(current_level + 1);
    let level_range = next_level_base_xp - current_level_base_xp;
    let xp_into_level = total_xp.saturating_sub(current_level_base_xp);

    let progress_pct = if level_range > 0 {
        ((xp_into_level as f64 / level_range as f64) * 100.0) as f32
    } else {
        100.0
    };

    let (tier, tier_name, tier_color) = if current_level < 10 {
        (Tier::Bronze, "Bronze".to_string(), "#cd7f32".to_string())
    } else if current_level < 20 {
        (Tier::Silver, "Silver".to_string(), "#c0c0c0".to_string())
    } else if current_level < 30 {
        (Tier::Gold, "Gold".to_string(), "#ffd700".to_string())
    } else {
        (Tier::Legend, "Legend".to_string(), "#a855f7".to_string())
    };

    LevelProgress {
        level: current_level,
        tier,
        tier_name,
        tier_color,
        current_xp: total_xp,
        current_level_xp: current_level_base_xp,
        next_level_xp: next_level_base_xp,
        progress_pct: progress_pct.clamp(0.0, 100.0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xp_thresholds() {
        assert_eq!(xp_needed_for_level(1), 0);
        assert_eq!(xp_needed_for_level(2), 200);
        assert_eq!(xp_needed_for_level(10), 9 * 200); // 1800
        assert_eq!(xp_needed_for_level(11), 1800 + 300); // 2100
    }

    #[test]
    fn test_calculate_level() {
        let p1 = calculate_level(0);
        assert_eq!(p1.level, 1);
        assert_eq!(p1.tier, Tier::Bronze);
        assert_eq!(p1.progress_pct, 0.0);

        let p2 = calculate_level(200);
        assert_eq!(p2.level, 2);
        assert_eq!(p2.tier, Tier::Bronze);

        let p3 = calculate_level(1800);
        assert_eq!(p3.level, 10);
        assert_eq!(p3.tier, Tier::Silver);
    }
}
