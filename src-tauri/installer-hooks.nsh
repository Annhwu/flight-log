!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Var LangChoice
Var RadioEn
Var RadioFr
Var RadioRu

Page custom LangPageCreate LangPageLeave

Function LangPageCreate
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 15u 100% 14u "Choose the application language / Choisissez la langue / Выберите язык"
  Pop $0

  ${NSD_CreateRadioButton} 40u 45u 160u 14u "English"
  Pop $RadioEn
  ${NSD_SetState} $RadioEn ${BST_CHECKED}

  ${NSD_CreateRadioButton} 40u 63u 160u 14u "Français"
  Pop $RadioFr

  ${NSD_CreateRadioButton} 40u 81u 160u 14u "Русский"
  Pop $RadioRu

  nsDialogs::Show
FunctionEnd

Function LangPageLeave
  StrCpy $LangChoice "en"

  ${NSD_GetState} $RadioFr $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $LangChoice "fr"
  ${EndIf}

  ${NSD_GetState} $RadioRu $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $LangChoice "ru"
  ${EndIf}
FunctionEnd

!macro customInstall
  CreateDirectory "$APPDATA\com.flight.log"
  FileOpen $0 "$APPDATA\com.flight.log\lang.ini" w
  FileWrite $0 "lang=$LangChoice"
  FileClose $0
!macroend
