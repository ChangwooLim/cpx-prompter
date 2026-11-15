# CPX 프롬프터

CPX 영상을 찍을 때 카메라 뒤에 띄워 두고 읽는 자동 스크롤 대본 페이지입니다.

https://changwoolim.github.io/cpx-prompter/

처음 쓴다면 [설명서](https://changwoolim.github.io/cpx-prompter/guide.html)를 따라 하세요. 프롬프터 화면 오른쪽 위 **설명서** 버튼으로도 열 수 있습니다.

## 쓰는 순서

1. 내 대본을 프롬프터 양식(JSON)으로 바꿉니다. 방법은 아래 셋 중 하나입니다.
2. 페이지에서 "대본 불러오기"를 누르고 JSON 파일을 넣거나, JSON을 붙여 넣습니다.
3. 위쪽 목록에서 대본을 고르고 "시작"을 누릅니다.

불러온 대본은 그 기기 브라우저에만 저장됩니다. 서버로 보내지 않습니다. 다른 기기에서 쓰려면 그 기기에서 한 번 더 불러오세요.

## 대본을 양식으로 바꾸는 방법

### 1. ChatGPT나 Claude에 프롬프트 붙여 넣기

1. [변환 프롬프트](skill/prompter/prompt.md)를 통째로 복사합니다. 페이지의 "대본 불러오기" 창에 있는 "프롬프트 복사" 버튼을 눌러도 됩니다.
2. AI 채팅에 붙여 넣고, 대본 Word 파일을 첨부하거나 본문을 붙여 넣습니다.
3. AI가 준 JSON을 복사해서 "대본 불러오기" 창에 붙여 넣습니다. 앞뒤의 ```json 표시는 그대로 붙여 넣어도 됩니다.

### 2. Claude Code

Claude 앱의 Code 탭에 문장 하나를 붙여 넣고 대본 파일을 끌어다 놓으면 됩니다. 설치는 없습니다. 붙여 넣을 문장과 순서는 [설명서](https://changwoolim.github.io/cpx-prompter/guide.html#convert)에 있습니다.

자주 쓴다면 스킬로 설치해서 `/prompter`로 부를 수도 있습니다.

```bash
git clone https://github.com/ChangwooLim/cpx-prompter.git
mkdir -p ~/.claude/skills && cp -R cpx-prompter/skill/prompter ~/.claude/skills/prompter
```

그다음 Claude Code에서 이렇게 씁니다.

```
/prompter ~/Downloads/내대본.docx
```

대본 옆에 `내대본.prompter.json`이 생기고, 양식 검사까지 통과한 상태로 나옵니다.

### 3. 직접 쓰기

[sample.json](sample.json)을 복사해서 고칩니다. 규칙은 [변환 프롬프트](skill/prompter/prompt.md)의 "형식" 절에 있습니다. 다 쓰면 Node.js로 검사할 수 있습니다.

```bash
node skill/prompter/validate.mjs 내대본.json
```

## 양식 요약

```json
{
  "format": "cpx-prompter/1",
  "title": "주요우울장애 · 홍길동 28세",
  "sections": [
    {
      "title": "도입",
      "time": "0:00-0:40",
      "lines": [
        { "지시": "의사: 노크 → 손 소독 → 착석" },
        { "의사": "{미소} 안녕하세요, 학생의사 ○○○입니다." },
        { "환자": "{작은 목소리로} 홍길동이요." }
      ]
    }
  ]
}
```

- 줄의 키는 `의사`, `환자`, `지시`(대사 없는 동작), `소제목` 넷입니다.
- 대사 안의 `{…}`는 연기 지시, `[…]`는 읽지 않는 표시(채점 번호 등), `[[생략 가능]]`은 시간이 넘칠 때 뺄 대사입니다.
- `time`은 모든 구간에 쓰거나 모두 빼야 합니다. 빼면 대사 길이로 시간을 자동 계산합니다.

## 프롬프터 조작

| 키 | 동작 |
| --- | --- |
| Space, 화면 탭 | 재생·정지 |
| ↑ ↓ | 속도 |
| + − | 글자 크기 |
| ← → | 이전·다음 구간 |
| M | 좌우 반전 |
| F | 전체 화면 |
| R | 처음으로 |

1.0× 속도면 대본 전체가 마지막 구간이 끝나는 시간 동안 흘러갑니다. 위쪽에 경과 시간과 구간별로 빠른지 늦은지가 나옵니다.
