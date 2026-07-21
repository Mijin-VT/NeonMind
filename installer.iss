; Script de Inno Setup para NeonMind
; Versión optimizada y corregida

[Setup]
AppId={{867F5D1A-9B3B-4952-B4F2-7CECE6B68584}}
AppName=NeonMind
AppVersion=0.1.0
AppVerName=NeonMind 0.1.0
AppPublisher=Antigravity
AppCopyright=Copyright (C) Antigravity
DefaultDirName={autopf}\NeonMind
DefaultGroupName=NeonMind
DisableProgramGroupPage=yes
DisableWelcomePage=no

; Salida del instalador
OutputDir=Output
OutputBaseFilename=NeonMind-0.1.0-Setup

; Icono e imágenes de presentación
SetupIconFile=D:\Desktop\AGENTES\BOBEDA DE LINKS\installer_icon.ico
WizardSmallImageFile=D:\Desktop\AGENTES\BOBEDA DE LINKS\ChatGPT Image 15 jul 2026, 22_41_40.png
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

; Privilegios
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline dialog

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{app}"; Permissions: users-modify

[Files]
; Copiar todos los archivos del proyecto excluyendo dependencias de desarrollo y el directorio de salida del instalador
Source: "D:\Desktop\AGENTES\BOBEDA DE LINKS\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs; Excludes: "node_modules,node_modules\*,src-tauri\target,src-tauri\target\*,lily-backend\venv,lily-backend\venv\*,.git,.git\*,*.iss,Output,Output\*,*.db-shm,*.db-wal"

[Icons]
Name: "{group}\NeonMind"; Filename: "{app}\NeonMind.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\NeonMind"; Filename: "{app}\NeonMind.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\INSTALL.bat"; Parameters: "/production"; StatusMsg: "Instalando dependencias de NeonMind... (Este proceso puede tardar varios minutos)"; Flags: runasoriginaluser waituntilterminated

[UninstallRun]
; Opcional: Ejecutar algo antes de desinstalar (si lo deseas)

[Code]
var
  UninstallForm: TSetupForm;
  UninstallCheckListBox: TNewCheckListBox;
  OKButton, CancelButton: TNewButton;

function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
  UninstallNode, UninstallPython, UninstallOllama, UninstallRust, UninstallVS: Boolean;
  CmdArgs: String;
begin
  Result := True;

  // Si no existe el script de desinstalación de dependencias, continuamos normalmente
  if not FileExists(ExpandConstant('{app}\UNINSTALL_DEPS.bat')) then
    Exit;

  // Crear formulario personalizado
  UninstallForm := CreateCustomForm(ScaleX(500), ScaleY(380), False, False);
  UninstallForm.Caption := 'Desinstalador de NeonMind - Componentes Adicionales';
  UninstallForm.Position := poScreenCenter;

  // Título
  with TLabel.Create(UninstallForm) do
  begin
    Parent := UninstallForm;
    Left := ScaleX(20);
    Top := ScaleY(15);
    Width := UninstallForm.ClientWidth - ScaleX(40);
    Height := ScaleY(60);
    AutoSize := False;
    WordWrap := True;
    Font.Style := [fsBold];
    Caption := '¿Desea desinstalar también las herramientas de desarrollo y dependencias del sistema instaladas para NeonMind?'#13#10 +
               'Seleccione los programas que desea remover:';
  end;

  // Checklist
  UninstallCheckListBox := TNewCheckListBox.Create(UninstallForm);
  UninstallCheckListBox.Parent := UninstallForm;
  UninstallCheckListBox.Left := ScaleX(20);
  UninstallCheckListBox.Top := ScaleY(85);
  UninstallCheckListBox.Width := UninstallForm.ClientWidth - ScaleX(40);
  UninstallCheckListBox.Height := ScaleY(200);

  UninstallCheckListBox.AddCheckBox('Node.js LTS (Entorno de ejecución JavaScript)', '', 0, False, True, False, True, nil);
  UninstallCheckListBox.AddCheckBox('Python 3.11 (Requerido por el backend de IA)', '', 0, False, True, False, True, nil);
  UninstallCheckListBox.AddCheckBox('Ollama (Servicio local de Inteligencia Artificial)', '', 0, False, True, False, True, nil);
  UninstallCheckListBox.AddCheckBox('Rust + Cargo (Para compilar Tauri)', '', 0, False, True, False, True, nil);
  UninstallCheckListBox.AddCheckBox('Visual Studio 2022 Build Tools (Compilador C++)', '', 0, False, True, False, True, nil);

  // Botones
  OKButton := TNewButton.Create(UninstallForm);
  OKButton.Parent := UninstallForm;
  OKButton.Caption := 'Siguiente';
  OKButton.Default := True;
  OKButton.ModalResult := mrOk;
  OKButton.Left := UninstallForm.ClientWidth - ScaleX(220);
  OKButton.Top := UninstallForm.ClientHeight - ScaleY(45);
  OKButton.Width := ScaleX(95);
  OKButton.Height := ScaleY(30);

  CancelButton := TNewButton.Create(UninstallForm);
  CancelButton.Parent := UninstallForm;
  CancelButton.Caption := 'Cancelar';
  CancelButton.Cancel := True;
  CancelButton.ModalResult := mrCancel;
  CancelButton.Left := UninstallForm.ClientWidth - ScaleX(110);
  CancelButton.Top := UninstallForm.ClientHeight - ScaleY(45);
  CancelButton.Width := ScaleX(95);
  CancelButton.Height := ScaleY(30);

  // Mostrar formulario
  if UninstallForm.ShowModal() = mrOk then
  begin
    UninstallNode   := UninstallCheckListBox.Checked[0];
    UninstallPython := UninstallCheckListBox.Checked[1];
    UninstallOllama := UninstallCheckListBox.Checked[2];
    UninstallRust   := UninstallCheckListBox.Checked[3];
    UninstallVS     := UninstallCheckListBox.Checked[4];

    CmdArgs := '';
    if UninstallNode   then CmdArgs := CmdArgs + ' --node';
    if UninstallPython then CmdArgs := CmdArgs + ' --python';
    if UninstallOllama then CmdArgs := CmdArgs + ' --ollama';
    if UninstallRust   then CmdArgs := CmdArgs + ' --rust';
    if UninstallVS     then CmdArgs := CmdArgs + ' --vs';

    if CmdArgs <> '' then
    begin
      // Copiar script a carpeta temporal antes de que Inno Setup borre {app}
      CopyFile(ExpandConstant('{app}\UNINSTALL_DEPS.bat'), 
               ExpandConstant('{tmp}\UNINSTALL_DEPS.bat'), False);

      if not Exec(ExpandConstant('{tmp}\UNINSTALL_DEPS.bat'), CmdArgs, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
      begin
        MsgBox('Error al ejecutar el script de desinstalación de dependencias:'#13#10 +
               SysErrorMessage(ResultCode), mbError, MB_OK);
      end;
    end;
  end
  else
  begin
    // Usuario canceló → abortar desinstalación completa
    Result := False;
  end;
end;
