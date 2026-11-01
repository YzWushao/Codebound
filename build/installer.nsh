; Extend electron-builder's assisted installer while retaining its uninstall,
; elevation and user-data preservation routines.
!include LogicLib.nsh
!ifndef BUILD_UNINSTALLER
Var codeboundUpgrade
Var codeboundUpgradeScope
Var codeboundUpgradeDirectory

; electron-builder 26.18 generates this LogicLib condition before our include.
; Treat a detected installation like --updated so directory/license pages skip.
!macroundef _isUpdated
!macro _isUpdated _a _b _t _f
  ${StdUtils.TestParameter} $R9 "updated"
  ; LogicLib can pass a fall-through true target: branch only at the last line.
  StrCmp $codeboundUpgrade "1" 0 +2
    StrCpy $R9 "true"
  StrCmp "$R9" "true" `${_t}` `${_f}`
!macroend

!macro codeboundChooseExisting ROOT SCOPE
  ReadRegStr $R1 ${ROOT} "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R1 != ""
  ${AndIf} ${FileExists} "$R1\${APP_EXECUTABLE_FILENAME}"
  ${AndIf} ${FileExists} "$R1\${UNINSTALL_FILENAME}"
    StrCpy $codeboundUpgrade "1"
    StrCpy $codeboundUpgradeScope "${SCOPE}"
    StrCpy $codeboundUpgradeDirectory "$R1"
    StrCpy $INSTDIR "$R1"
  ${EndIf}
!macroend

!macro customInit
  StrCpy $codeboundUpgrade "0"
  StrCpy $codeboundUpgradeScope ""
  StrCpy $codeboundUpgradeDirectory ""
  ${If} ${isForAllUsers}
    !insertmacro codeboundChooseExisting HKLM "all"
  ${ElseIf} ${isForCurrentUser}
    !insertmacro codeboundChooseExisting HKCU "CurrentUser"
  ${Else}
    ; Prefer the caller's installation when both scopes exist.
    !insertmacro codeboundChooseExisting HKCU "CurrentUser"
    ${If} $codeboundUpgrade != "1"
      !insertmacro codeboundChooseExisting HKLM "all"
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstallMode
  ${If} $codeboundUpgrade == "1"
    ${If} $codeboundUpgradeScope == "all"
      StrCpy $isForceMachineInstall "1"
    ${Else}
      StrCpy $isForceCurrentInstall "1"
    ${EndIf}
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
  ; Run after the directory page (which is skipped during an upgrade).
  ; Reapply the recorded path so /D cannot accidentally relocate an upgrade.
  Function codeboundRestoreUpgradeDirectory
    ${If} $codeboundUpgrade == "1"
      StrCpy $INSTDIR "$codeboundUpgradeDirectory"
    ${EndIf}
    Abort
  FunctionEnd
  !macro customPageAfterChangeDir
    Page custom codeboundRestoreUpgradeDirectory
  !macroend
!endif

!endif ; BUILD_UNINSTALLER

!macro customCheckAppRunning
  ; WM_CLOSE allows Electron to flush its save queue. Never force-kill it.
  codebound_wait_for_exit:
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${If} $R0 == 0
      FindWindow $R1 "Chrome_WidgetWin_1" "${PRODUCT_NAME} · 码境远征"
      ${If} $R1 != 0
        SendMessage $R1 ${WM_CLOSE} 0 0 /TIMEOUT=2000
      ${EndIf}
      StrCpy $R2 0
      codebound_exit_poll:
        Sleep 250
        nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
        Pop $R0
        ${If} $R0 != 0
          Goto codebound_exit_ready
        ${EndIf}
        IntOp $R2 $R2 + 1
        IntCmp $R2 40 0 codebound_exit_poll 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请关闭 ${PRODUCT_NAME}，保存进度后继续。" /SD IDCANCEL IDRETRY codebound_wait_for_exit
      Quit
    ${EndIf}
  codebound_exit_ready:
!macroend

!ifdef CODEBOUND_INSTALLER_QA
  !ifndef BUILD_UNINSTALLER
  !macro customInstall
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CodeboundQAUpgrade "$codeboundUpgrade"
  !macroend
  !endif
!endif
