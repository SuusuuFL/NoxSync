mod schema;

// Re-export schema types
pub use schema::ProjectFile;

use std::path::PathBuf;
use std::fs;
use crate::config::get_config;
use crate::error::{NoxError, Result};

/// Get the path to project.json for a project
pub fn get_project_file_path(project_name: &str) -> PathBuf {
    let config = get_config();
    config.project_dir(project_name).join("project.json")
}

/// Load a project file
pub fn load_project(project_name: &str) -> Result<Option<ProjectFile>> {
    let path = get_project_file_path(project_name);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)?;
    let project: ProjectFile = serde_json::from_str(&content)
        .map_err(|e| NoxError::Config(format!("Failed to parse project.json: {}", e)))?;

    Ok(Some(project))
}

/// Save a project file
pub fn save_project(project_name: &str, project: &ProjectFile) -> Result<()> {
    let config = get_config();
    let project_dir = config.project_dir(project_name);

    // Ensure directory exists
    if !project_dir.exists() {
        fs::create_dir_all(&project_dir)?;
    }

    let path = project_dir.join("project.json");
    let content = serde_json::to_string_pretty(project)
        .map_err(|e| NoxError::Config(format!("Failed to serialize project: {}", e)))?;

    fs::write(&path, content)?;
    log::info!("Saved project to {:?}", path);

    Ok(())
}

/// List all projects in the work directory
pub fn list_projects() -> Result<Vec<String>> {
    let config = get_config();
    let output_dir = &config.output_dir;

    if !output_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();

    for entry in fs::read_dir(output_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Check if it has a project.json
            let project_file = path.join("project.json");
            if project_file.exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    projects.push(name.to_string());
                }
            }
        }
    }

    Ok(projects)
}

/// Delete a project and all its files
pub fn delete_project(project_name: &str) -> Result<()> {
    let config = get_config();
    let project_dir = config.project_dir(project_name);

    if project_dir.exists() {
        fs::remove_dir_all(&project_dir)?;
        log::info!("Deleted project directory: {:?}", project_dir);
    }

    Ok(())
}

