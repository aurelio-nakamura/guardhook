// guardhook — secret & sensitive-file detection.
//
// A second guardrail beside the destructive-command engine: stop an agent from
// hard-coding a live credential into a file, or writing to a file that should
// never be machine-edited (private keys, credential stores). High-precision by
// design — every pattern targets material that is almost certainly a real
// secret, so the guard stays trustworthy and quiet on ordinary code.

export interface SecretHit {
  name: string;
}

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: "Stripe secret key", re: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  { name: "OpenAI/Anthropic-style key", re: /\bsk-(?:ant-)?[A-Za-z0-9_\-]{24,}\b/ },
  { name: "JSON web token", re: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/ },
  {
    name: "hard-coded credential assignment",
    re: /\b(?:api[_-]?key|secret|secret[_-]?key|password|passwd|access[_-]?token|auth[_-]?token)\s*[=:]\s*["'][^"'\s]{8,}["']/i,
  },
];

// Filenames / paths that should essentially never be machine-generated or
// edited by an autonomous agent.
const SENSITIVE_PATH_RE =
  /(^|\/)(\.env(\.[A-Za-z0-9_-]+)?|id_[a-z]+|.*\.pem|\.npmrc|\.pypirc|credentials|\.aws\/credentials|\.ssh\/[^/]+|\.git-credentials)$/i;

// Scan free text (file content, a command line) for likely secret material.
export function scanSecrets(text: string): SecretHit[] {
  if (!text) return [];
  const hits: SecretHit[] = [];
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(text)) hits.push({ name: p.name });
  }
  return hits;
}

// Is this a path an agent should not be writing to unprompted?
export function isSensitivePath(filePath: string): boolean {
  if (!filePath) return false;
  return SENSITIVE_PATH_RE.test(filePath.trim());
}
