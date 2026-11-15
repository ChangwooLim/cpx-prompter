---
name: prompter
description: Convert a CPX script (.docx, .txt, .md, or pasted text) into cpx-prompter/1 JSON for the CPX prompter page at https://changwoolim.github.io/cpx-prompter/. Use for /prompter, "프롬프터 json 만들어줘", "이 대본 프롬프터 양식으로 바꿔줘".
argument-hint: <대본 파일 경로, 또는 대본 붙여 넣기>
---

# /prompter

Turn one CPX script into one `cpx-prompter/1` JSON file that the prompter page loads. Files below live in this skill's base directory. Run the commands from that directory.

If you are reading this file from GitHub rather than as an installed skill, download every file in https://raw.githubusercontent.com/ChangwooLim/cpx-prompter/main/skill/prompter/ (`SKILL.md`, `prompt.md`, `format.js`, `validate.mjs`, `docx_text.py`) with `curl` into a new temporary folder and use that folder as the base directory. Read the raw files, not a summary.

Script to convert: $ARGUMENTS (when read from GitHub, the script is the file the user attached or named in the message)

Most users are medical students who do not use a terminal. Never ask them to install software. When a tool below is missing, take the fallback it names.

1. Get the script text.
   - `.docx`: `python3 docx_text.py "<file>"`. It prints one paragraph per line, marks Word headings with `#`, and wraps italic runs in `*…*`, which usually mark acting directions. If `python3` is missing, use a built-in tool instead: `textutil -convert txt -stdout "<file>"` on macOS, or PowerShell's `System.IO.Compression.ZipFile` on Windows to read `word/document.xml` (one line per `</w:p>`, tags stripped).
   - `.txt` or `.md`: read the file.
   - Pasted text: use it as given. No script at all: ask the user to drag the script file into the chat, and stop.
2. Convert it with the format and rules in `prompt.md`. That file is the contract. Copy dialogue verbatim and never invent section times. Skip its "답하는 방식" section; steps 3 to 5 replace it.
3. Write `<source name>.prompter.json` next to the source file, or in the current directory for pasted text. UTF-8, 2-space indent.
4. Run `node validate.mjs "<output>"`. Fix the JSON and rerun until it prints `OK`. If `node` is missing, check the JSON against the list at the end of `prompt.md` yourself, and tell the user the page checks the file again when it loads.
5. Reply in Korean, in plain words for a beginner:
   - which folder the new file is in, by its everyday name (예: 다운로드 폴더), and the file name;
   - the length, and when it exceeds `limit`, that `[[생략 가능]]` lines can be skipped;
   - the points `prompt.md` says to flag: odd order in the source, unclear speakers, sections you created;
   - the next step: https://changwoolim.github.io/cpx-prompter/ 를 열고 오른쪽 위 **대본 불러오기** → **JSON 파일 고르기**로 이 파일을 고르면 된다는 안내.
