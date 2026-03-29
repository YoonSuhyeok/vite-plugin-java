# Standalone Vite + Java 연동 예제

이 예제는 `vite-plugin-java` 라이브러리 **없이**, `vite.config.ts`에 직접 플러그인 로직을 작성하여 Java (Spring MVC) 백엔드와 Vite를 통합하는 방법을 보여줍니다.

## 핵심 개념

`vite-plugin-java`가 제공하는 기능은 Vite의 [Plugin API](https://vitejs.dev/guide/api-plugin.html)를 사용하여 직접 구현할 수 있습니다. `vite.config.ts` 파일 안에 인라인 플러그인을 작성하면 외부 의존성 없이 동일한 결과를 얻을 수 있습니다.

## `vite.config.ts`에서 구현하는 기능

| 기능 | 구현 방법 |
|------|----------|
| **Manifest 생성** | `build.manifest: '.vite/manifest.json'` |
| **빌드 출력 경로** | `build.outDir` 으로 Java 프로젝트의 webapp 경로 설정 |
| **Base URL** | `ASSET_URL` 환경변수 + `buildDirectory`로 동적 계산 |
| **에셋 인라이닝 비활성화** | `build.assetsInlineLimit: 0` |
| **Hot 파일 생성/삭제** | `configureServer` 훅에서 `public/hot` 파일 관리 |
| **개발 서버 URL 치환** | `transform` 훅에서 placeholder → 실제 URL 치환 |
| **`@` 경로 별칭** | `resolve.alias: { '@': '/src' }` |
| **Java 버전 감지** | `pom.xml` / `build.gradle` 파싱 함수 직접 구현 |

## 빠른 시작

```sh
cd examples/standalone/client
pnpm install
pnpm dev
```

## `vite-plugin-java` 사용 시와의 비교

### 라이브러리 사용 (`examples/vanilla`)

```ts
import java from 'vite-plugin-java'

export default defineConfig({
  plugins: [java({
    input: 'src/main.ts',
    outputDirectory: '../server/src/main/webapp/WEB-INF/dist',
    javaProjectBase: '../server',
  })],
})
```

### 라이브러리 없이 (`examples/standalone`)

```ts
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

function javaIntegrationPlugin(): Plugin {
  return {
    name: 'java-integration',
    enforce: 'post',
    config(_config, { command, mode }) {
      const env = loadEnv(mode, _config.envDir || process.cwd(), '')
      const assetUrl = env.ASSET_URL ?? '/'
      return {
        base: command === 'build' ? `${assetUrl}build/` : '',
        build: {
          manifest: '.vite/manifest.json',
          outDir: '../server/src/main/webapp/WEB-INF/dist',
          rollupOptions: { input: 'src/main.ts' },
          assetsInlineLimit: 0,
        },
        server: { origin: '__placeholder__', host: 'localhost', port: 5173 },
        resolve: { alias: { '@': '/src' } },
      }
    },
    transform(code) { /* placeholder 치환 */ },
    configureServer(server) { /* hot 파일 생성/삭제 */ },
  }
}

export default defineConfig({
  plugins: [javaIntegrationPlugin()],
})
```

## 언제 어떤 방식을 사용할까?

| 기준 | `vite-plugin-java` 사용 | 직접 구현 (`standalone`) |
|------|------------------------|------------------------|
| **설정 간결함** | ✅ 설정 객체만 전달 | ❌ 플러그인 로직 직접 작성 |
| **의존성 관리** | ❌ 추가 패키지 필요 | ✅ 추가 패키지 불필요 |
| **업데이트** | ✅ 패키지 업데이트로 새 기능 적용 | ❌ 직접 코드 수정 필요 |
| **커스터마이징** | 제한적 (설정 옵션 범위 내) | ✅ 완전한 제어 |
| **프로젝트 규모** | 중/대규모 프로젝트에 적합 | 소규모, 단순한 프로젝트에 적합 |
| **디버깅** | `debug` 모듈 내장 | 직접 로깅 추가 필요 |
