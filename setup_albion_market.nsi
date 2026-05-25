!include "MUI2.nsh"

!define PRODUCT_NAME "Albion Market"
!define PRODUCT_VERSION "1.0"
!define COMPANY_NAME "Albion Shop"
!define INSTALLER_NAME "AlbionMarketInstaller.exe"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${INSTALLER_NAME}"
InstallDir "$PROGRAMFILES\${PRODUCT_NAME}"
InstallDirRegKey HKLM "Software\${COMPANY_NAME}\${PRODUCT_NAME}" "Install_Dir"
RequestExecutionLevel admin
SetCompress off
ShowInstDetails show

!define MUI_ICON "logo.ico"
!define MUI_UNICON "logo.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "dist\AlbionMarket\*"
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk" "$INSTDIR\AlbionMarket.exe" "" "$INSTDIR\logo.ico"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\AlbionMarket.exe" "" "$INSTDIR\logo.ico"
  WriteRegStr HKLM "Software\${COMPANY_NAME}\${PRODUCT_NAME}" "Install_Dir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk"
  Delete "$INSTDIR\AlbionMarket.exe"
  Delete "$INSTDIR\logo.ico"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  DeleteRegKey HKLM "Software\${COMPANY_NAME}\${PRODUCT_NAME}"
SectionEnd
