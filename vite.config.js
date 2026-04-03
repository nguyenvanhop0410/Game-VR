import { defineConfig } from 'vite';

const repoName = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split('/')[1]
  : '';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPages ? `/${repoName}/` : '/',
  server: {
    host: true,
    port: 5173
  }
});
