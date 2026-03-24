# 프로젝트 기능 분석 (Feature Analysis)

## 1. 프로젝트 개요

**vite-plugin-java**는 Java (Spring MVC) 백엔드 서버와 모던 프론트엔드 빌드 도구인 [Vite](https://vitejs.dev)를 통합하기 위한 Vite 플러그인입니다. [laravel/vite-plugin](https://github.com/laravel/vite-plugin)에서 영감을 받아 개발되었으며, Java 웹 애플리케이션을 위한 에셋 관리 및 HMR(Hot Module Replacement) 기능을 제공합니다.

- **버전**: 0.2.1
- **라이선스**: MIT
- **패키지 매니저**: pnpm (모노레포 구조)

---

## 2. 프로젝트 구조

```
vite-plugin-java/
├── packages/
│   └── vite-plugin-java/          # 핵심 플러그인 패키지
│       ├── src/
│       │   ├── index.ts           # 메인 진입점 및 타입 정의
│       │   ├── vite-plugin-java.ts # 핵심 플러그인 구현
│       │   ├── utils.ts           # 유틸리티 함수
│       │   └── dev-server-index.html # 개발 서버 랜딩 페이지
│       └── test/
│           ├── plugin.test.ts     # 플러그인 기능 테스트
│           ├── utils.test.ts      # 유틸리티 기능 테스트
│           └── fixtures/          # 테스트용 Java 빌드 파일
├── examples/
│   └── vanilla/                   # 예제 프로젝트
├── eslint.config.mjs              # ESLint 설정
├── tsconfig.json                  # TypeScript 설정
└── pnpm-workspace.yaml            # pnpm 워크스페이스 설정
```

---

## 3. 핵심 기능 분석

### 3.1 플러그인 초기화 (`java()` 함수)

**파일**: `src/vite-plugin-java.ts` (26-33행)

플러그인의 메인 진입점으로, 문자열, 배열, 또는 설정 객체를 받아 Vite 플러그인 배열을 반환합니다.

```typescript
// 사용 방법 1: 단일 입력
java('src/main.ts')

// 사용 방법 2: 배열 입력
java(['src/main.ts', 'src/admin.ts'])

// 사용 방법 3: 설정 객체
java({
  input: 'src/main.ts',
  publicDirectory: 'public',
  buildDirectory: 'build',
})
```

### 3.2 설정 옵션 (`VitePluginJavaConfig`)

**파일**: `src/index.ts` (3-48행)

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `input` | `string \| string[] \| object` | (필수) | 컴파일할 엔트리 포인트 |
| `publicDirectory` | `string` | `'public'` | 정적 에셋 디렉토리 |
| `buildDirectory` | `string` | `'build'` | 컴파일된 에셋이 출력되는 하위 디렉토리 |
| `outputDirectory` | `string` | `'dist'` | 번들 출력 디렉토리 |
| `javaProjectBase` | `string` | `'.'` | Java 프로젝트 루트 경로 |
| `hotFile` | `string \| false` | `publicDirectory + '/hot'` | Hot 파일 경로 (`false`로 비활성화 가능) |
| `transformOnServe` | `function` | `code => code` | 서빙 시 코드 변환 함수 |

### 3.3 Vite 빌드 설정 자동 구성

**파일**: `src/vite-plugin-java.ts` (50-101행)

`config` 훅에서 다음 Vite 설정을 자동으로 구성합니다:

- **`base`**: 빌드 시 `ASSET_URL` 환경변수 + `buildDirectory`로 설정
- **`publicDir`**: 사용자 설정 또는 `publicDirectory`로 설정
- **`build.manifest`**: `.vite/manifest.json`으로 기본 설정 (Spring MVC에서 에셋 매핑 시 사용)
- **`build.outDir`**: `outputDirectory`로 설정
- **`build.rollupOptions.input`**: 사용자 지정 엔트리 포인트 설정
- **`build.assetsInlineLimit`**: 기본 `0`으로 설정 (인라이닝 비활성화)
- **`server.origin`**: 개발 시 `__java_vite_placeholder__` 플레이스홀더 설정
- **`server.host`**: 기본 `localhost`
- **`server.port`**: `VITE_PORT` 환경변수 또는 기본 `5173`
- **`resolve.alias`**: `@` → `/src` 기본 별칭 설정

### 3.4 HMR (Hot Module Replacement) 지원

**파일**: `src/vite-plugin-java.ts` (107-113행, 115-170행)

#### 플레이스홀더 치환 (`transform` 훅)
개발 서버 모드에서 `__java_vite_placeholder__` 문자열을 실제 개발 서버 URL로 치환합니다. 이를 통해 Java 백엔드에서 Vite 개발 서버의 에셋을 참조할 수 있습니다.

#### Hot 파일 생성 (`configureServer` 훅)
개발 서버가 시작되면 `publicDirectory/hot` 경로에 Hot 파일을 생성합니다. 이 파일에는 개발 서버 URL이 저장되며, Java 백엔드에서 이 파일을 읽어 개발 모드/프로덕션 모드를 구분합니다.

#### 프로세스 종료 시 정리
`SIGINT`, `SIGTERM`, `SIGHUP` 시그널과 프로세스 종료 시 Hot 파일을 자동으로 삭제합니다.

### 3.5 HTTPS/SSL 지원

**파일**: `src/vite-plugin-java.ts` (238-265행)

환경변수를 통한 HTTPS 설정을 지원합니다:

- `VITE_DEV_SERVER_KEY`: SSL 키 파일 경로
- `VITE_DEV_SERVER_CERT`: SSL 인증서 파일 경로
- `APP_URL`: HMR 호스트 추출에 사용

### 3.6 Java 프로젝트 자동 감지

**파일**: `src/utils.ts` (93-174행)

세 가지 Java 빌드 도구를 자동으로 감지합니다:

| 빌드 도구 | 감지 파일 | 버전 추출 방식 |
|-----------|----------|---------------|
| Maven | `pom.xml` | `<java.version>` 태그 |
| Gradle | `build.gradle` | `sourceCompatibility` 속성 |
| Kotlin DSL | `build.gradle.kts` | `sourceCompatibility` 또는 `java.sourceCompatibility` 속성 |

감지된 Java 버전은 개발 서버 시작 시 콘솔에 표시됩니다.

### 3.7 Properties 파일 파싱

**파일**: `src/utils.ts` (119-135행)

`readPropertiesFile()` 함수는 Java의 `.properties` 파일을 glob 패턴으로 찾아 파싱합니다:

- `#`으로 시작하는 주석 행을 필터링
- `key=value` 형태의 속성을 `Map<string, string>`으로 반환
- `app.url` 등의 속성을 읽어 Vite 설정에 활용

### 3.8 동적 엔트리 포인트 탐색 (`createRollupInputConfig`)

**파일**: `src/utils.ts` (44-63행)

glob 패턴을 사용하여 엔트리 파일을 동적으로 찾아 Rollup 입력 설정 객체를 생성합니다:

```typescript
// 'src/**/main.ts' 패턴으로 모든 main.ts 파일을 엔트리 포인트로 등록
const inputs = createRollupInputConfig('src/**/main.ts', 'src')
// 결과: { main: '/abs/path/src/main.ts', 'nested/main': '/abs/path/src/nested/main.ts' }
```

### 3.9 개발 서버 랜딩 페이지

**파일**: `src/dev-server-index.html`, `src/vite-plugin-java.ts` (159-169행)

개발 서버에서 `/index.html`에 접근하면 커스텀 랜딩 페이지를 표시합니다. Java + Vite 로고와 함께 Spring MVC 애플리케이션을 위한 HMR 개발 서버임을 안내하며, `{{ APP_URL }}` 플레이스홀더를 실제 값으로 치환합니다.

### 3.10 환경변수 지원

플러그인은 다음 환경변수를 지원합니다:

| 환경변수 | 용도 |
|---------|------|
| `ASSET_URL` | 프로덕션 빌드 시 에셋 기본 URL |
| `VITE_PORT` | 개발 서버 포트 오버라이드 |
| `APP_URL` | Java 백엔드 URL (콘솔 표시 및 HMR 호스트 설정) |
| `VITE_DEV_SERVER_KEY` | SSL 키 파일 경로 |
| `VITE_DEV_SERVER_CERT` | SSL 인증서 파일 경로 |
| `VITE_DEBUG_FILTER` | 디버그 로그 필터링 |

### 3.11 디버깅 지원

**파일**: `src/utils.ts` (21-34행)

`debug` 모듈을 활용한 조건부 디버그 로깅을 지원합니다. `VITE_DEBUG_FILTER` 환경변수로 특정 메시지만 필터링할 수 있습니다.

---

## 4. 빌드 및 배포

### 빌드 프로세스

- **빌드 도구**: `tsup` (TypeScript 번들러)
- **출력 포맷**: ESM (`.js`) 및 CJS (`.cjs`) 이중 지원
- **타입 정의**: `.d.ts` 파일 자동 생성
- **ESM 호환성**: CommonJS require 지원을 위한 배너 삽입

### 테스트

- **테스트 프레임워크**: Vitest
- **테스트 범위**: 플러그인 설정 검증 (8개), 유틸리티 함수 검증 (6개)
- **CI 환경**: Ubuntu, Windows, macOS 3개 OS에서 테스트

### 코드 품질

- **린팅**: ESLint (`@antfu/eslint-config`)
- **타입 검사**: TypeScript strict mode
- **CI/CD**: GitHub Actions를 통한 자동화

---

## 5. 동작 흐름 요약

### 개발 모드 (`vite dev`)

```
1. java() 플러그인 초기화
2. config 훅: Vite 설정 구성 (서버, 별칭, 플레이스홀더 등)
3. configureServer 훅:
   a. .properties 파일에서 APP_URL 읽기
   b. 서버 리스닝 시작 시:
      - Hot 파일 생성 (개발 서버 URL 저장)
      - Java 버전 및 APP_URL 콘솔 표시
   c. /index.html 요청 시 커스텀 랜딩 페이지 반환
4. transform 훅: __java_vite_placeholder__ → 실제 개발 서버 URL 치환
5. 프로세스 종료 시: Hot 파일 삭제
```

### 프로덕션 모드 (`vite build`)

```
1. java() 플러그인 초기화
2. config 훅: Vite 빌드 설정 구성
   - base URL: ASSET_URL + buildDirectory
   - manifest 파일 생성 설정
   - Rollup 엔트리 포인트 설정
   - 에셋 인라이닝 비활성화
3. 빌드 결과물 → outputDirectory에 출력
4. .vite/manifest.json 생성 (Java 백엔드에서 에셋 매핑에 사용)
```

---

## 6. 기술 스택 요약

| 카테고리 | 기술 |
|---------|------|
| 런타임 | Node.js (LTS) |
| 언어 | TypeScript 5.x |
| 빌드 | tsup, Vite 5.x / 6.x |
| 테스트 | Vitest |
| 린팅 | ESLint (@antfu/eslint-config) |
| 패키지 매니저 | pnpm 9.x (모노레포) |
| CI/CD | GitHub Actions |
| 주요 라이브러리 | debug, glob, dotenv, picocolors, smob |
