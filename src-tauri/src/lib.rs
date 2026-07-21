use tauri::Manager;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

struct PyServerState(Mutex<Option<Child>>);

fn new_background_command<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

fn get_project_root() -> std::path::PathBuf {
    // 1. Intentar buscar hacia arriba desde el directorio de trabajo actual
    if let Ok(current_dir) = std::env::current_dir() {
        let mut path = current_dir.clone();
        for _ in 0..10 {
            if path.join("lily-backend").exists() && path.join("src-tauri").exists() {
                return path;
            }
            if !path.pop() {
                break;
            }
        }
    }
    
    // 2. Intentar buscar hacia arriba desde la ruta del ejecutable actual
    if let Ok(exe_path) = std::env::current_exe() {
        let mut path = exe_path.clone();
        for _ in 0..10 {
            if path.join("lily-backend").exists() && path.join("src-tauri").exists() {
                return path;
            }
            if !path.pop() {
                break;
            }
        }
    }
    
    // 3. Fallback original
    let mut path = std::env::current_dir().unwrap_or_default();
    if path.ends_with("src-tauri") {
        path.pop();
    }
    path
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn get_clean_db_connection_str() -> String {
    let mut path = get_project_root();
    path.push("links.db");
    
    let path_str = path.to_string_lossy();
    // Strip Windows UNC prefix if present (e.g. \\?\)
    let clean_path = path_str.trim_start_matches(r#"\\?\"#);
    // Replace all backslashes with forward slashes and spaces with %20 for SQLite connection URI compatibility
    let formatted_path = clean_path.replace('\\', "/").replace(' ', "%20");
    format!("sqlite:{}", formatted_path)
}

#[tauri::command]
fn get_db_path() -> String {
    get_clean_db_connection_str()
}

#[tauri::command]
fn export_database(dest_path: String) -> Result<(), String> {
    let mut src_path = std::env::current_dir().unwrap_or_default();
    if src_path.ends_with("src-tauri") {
        src_path.pop();
    }
    src_path.push("links.db");

    if !src_path.exists() {
        return Err("La base de datos aún no ha sido creada o no contiene links.".to_string());
    }

    std::fs::copy(&src_path, &dest_path)
        .map(|_| ())
        .map_err(|e| format!("Error al exportar base de datos: {}", e))
}

#[tauri::command]
fn import_database(src_path: String) -> Result<(), String> {
    let mut dest_path = std::env::current_dir().unwrap_or_default();
    if dest_path.ends_with("src-tauri") {
        dest_path.pop();
    }
    dest_path.push("links.db");

    std::fs::copy(&src_path, &dest_path)
        .map(|_| ())
        .map_err(|e| format!("Error al importar base de datos: {}", e))
}

#[tauri::command]
fn is_autostart_enabled() -> Result<bool, String> {
    let output = new_background_command("reg")
        .args(&[
            "query",
            r#"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#,
            "/v",
            "NeonMind"
        ])
        .output();
        
    match output {
        Ok(out) => {
            Ok(out.status.success())
        }
        Err(e) => Err(format!("Error al consultar registro: {}", e))
    }
}

#[tauri::command]
fn enable_autostart() -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("No se pudo obtener la ruta del ejecutable: {}", e))?;
    let exe_str = exe_path.to_string_lossy();
    
    let status = new_background_command("reg")
        .args(&[
            "add",
            r#"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#,
            "/v",
            "NeonMind",
            "/t",
            "REG_SZ",
            "/d",
            &format!("\"{}\"", exe_str),
            "/f"
        ])
        .status()
        .map_err(|e| format!("Error al ejecutar reg add: {}", e))?;
        
    if status.success() {
        Ok(())
    } else {
        Err("No se pudo agregar la clave de auto-inicio al registro de Windows.".to_string())
    }
}

#[tauri::command]
fn disable_autostart() -> Result<(), String> {
    let status = new_background_command("reg")
        .args(&[
            "delete",
            r#"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"#,
            "/v",
            "NeonMind",
            "/f"
        ])
        .status()
        .map_err(|e| format!("Error al ejecutar reg delete: {}", e))?;
        
    if status.success() {
        Ok(())
    } else {
        Ok(())
    }
}

fn check_and_start_ollama() {
    use std::net::TcpStream;
    use std::time::Duration;
    
    if TcpStream::connect_timeout(
        &"127.0.0.1:11434".parse().unwrap(),
        Duration::from_millis(300)
    ).is_ok() {
        println!("Ollama ya está corriendo en el puerto 11434.");
        return;
    }

    println!("Ollama no responde. Intentando iniciar servicio de Ollama...");
    
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    if !local_app_data.is_empty() {
        let ollama_app_path = std::path::Path::new(&local_app_data)
            .join("Programs")
            .join("Ollama")
            .join("ollama app.exe");
            
        if ollama_app_path.exists() {
            println!("Iniciando Ollama App desde: {:?}", ollama_app_path);
            let _ = new_background_command(&ollama_app_path).spawn();
            return;
        }
    }
    
    println!("Ollama App no encontrada en LOCALAPPDATA. Intentando 'ollama serve'...");
    let _ = new_background_command("cmd")
        .args(&["/C", "start /B ollama serve"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                description TEXT,
                category TEXT,
                favorite INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );",
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "create_notes_table",
            sql: "CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                color TEXT,
                created_at TEXT NOT NULL
            );",
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "add_parent_id_to_links",
            sql: "ALTER TABLE links ADD COLUMN parent_id INTEGER REFERENCES links(id) ON DELETE CASCADE;",
            kind: tauri_plugin_sql::MigrationKind::Up,
        }
    ];

    let db_connection_str = get_clean_db_connection_str();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(&db_connection_str, migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(PyServerState(Mutex::new(None)))
        .setup(|app| {
            check_and_start_ollama();
            let root = get_project_root();
            let lily_dir = root.join("lily-backend");
            let python_exe = lily_dir.join("venv").join("Scripts").join("python.exe");
            
            let exe = if python_exe.exists() {
                python_exe
            } else {
                std::path::PathBuf::from("python")
            };
            
            println!("Iniciando backend de Lily con: {:?}", exe);
            
            let log_path = lily_dir.join("backend.log");
            let log_file = std::fs::File::create(&log_path).ok();
            
            let mut cmd = new_background_command(&exe);
            cmd.arg("-u")
               .arg("main.py")
               .current_dir(&lily_dir);
                
            if let Some(file) = log_file {
                if let Ok(err_file) = file.try_clone() {
                    cmd.stdout(Stdio::from(file))
                       .stderr(Stdio::from(err_file));
                } else {
                    cmd.stdout(Stdio::from(file))
                       .stderr(Stdio::null());
                }
            } else {
                cmd.stdout(Stdio::null())
                   .stderr(Stdio::null());
            }
            
            let spawn_log = root.join("spawn.log");
            let mut log_content = format!("exe: {:?}\nlily_dir: {:?}\nexists: {}\n", exe, lily_dir, exe.exists());
            
            match cmd.spawn() {
                Ok(child) => {
                    log_content.push_str(&format!("Spawn OK: PID {}\n", child.id()));
                    let _ = std::fs::write(&spawn_log, log_content);
                    let state = app.state::<PyServerState>();
                    *state.0.lock().unwrap() = Some(child);
                    println!("Backend de Lily iniciado correctamente.");
                }
                Err(e) => {
                    log_content.push_str(&format!("Spawn ERR: {}\n", e));
                    let _ = std::fs::write(&spawn_log, log_content);
                    eprintln!("Error al iniciar el backend de Lily: {}", e);
                }
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_db_path,
            export_database,
            import_database,
            is_autostart_enabled,
            enable_autostart,
            disable_autostart
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<PyServerState>();
                let mut lock = state.0.lock().unwrap();
                if let Some(mut child) = lock.take() {
                    println!("Terminando backend de Lily...");
                    #[cfg(target_os = "windows")]
                    {
                        let pid = child.id();
                        let _ = new_background_command("taskkill")
                            .args(&["/F", "/T", "/PID", &pid.to_string()])
                            .status();
                    }
                    #[cfg(not(target_os = "windows"))]
                    {
                        let _ = child.kill();
                    }
                }
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
