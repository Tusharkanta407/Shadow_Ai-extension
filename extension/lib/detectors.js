/**
 * Local pattern detectors for Shadow AI Radar.
 * Runs entirely in the browser — no prompt data leaves the device at this layer.
 */
(function (global) {
  const FILE_EXTENSIONS =
    /\b[\w.-]+\.(env|pem|key|p12|pfx|crt|cer|jks|kdbx|sql|dump|bak|csv|xlsx?|docx?|pdf|json|ya?ml|toml|ini|cfg|conf|properties|tfvars|keystore)\b/gi;

  const SOURCE_CODE_HINTS = [
    /\b(class|function|def|import|from|package|namespace|public static|private static)\b/,
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP)\s+.+\b(FROM|INTO|TABLE|SET)\b/i,
    /\b(const|let|var)\s+\w+\s*=/,
    /```[\s\S]{20,}```/,
    /\b(React|useState|useEffect|express\(\)|app\.get\(|fastapi|django)\b/i,
  ];

  const CONFIDENTIAL_HINTS = [
    /\b(confidential|internal only|do not share|trade secret|client database|roadmap|salary|ssn|nda)\b/i,
    /\b(prod(uction)?\s+(db|database|password|secret|key|credential)s?)\b/i,
    /\b(employee\s+(list|data|records)|payroll|hr\s+document)\b/i,
  ];

  /** @type {{ id: string, label: string, severity: 'critical'|'high'|'medium'|'low', pattern: RegExp, validate?: (m: string) => boolean }[]} */
  const RULES = [
    {
      id: "aws_access_key",
      label: "AWS Access Key",
      severity: "critical",
      pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    },
    {
      id: "aws_secret_key",
      label: "AWS Secret Key",
      severity: "critical",
      pattern: /(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    },
    {
      id: "openai_key",
      label: "OpenAI API Key",
      severity: "critical",
      pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    },
    {
      id: "openrouter_key",
      label: "OpenRouter API Key",
      severity: "critical",
      pattern: /\bsk-or-v1-[A-Za-z0-9]{20,}\b/g,
    },
    {
      id: "google_api_key",
      label: "Google API Key",
      severity: "critical",
      pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    },
    {
      id: "github_token",
      label: "GitHub Token",
      severity: "critical",
      pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
    },
    {
      id: "slack_token",
      label: "Slack Token",
      severity: "critical",
      pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    },
    {
      id: "jwt",
      label: "JWT Token",
      severity: "high",
      pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    },
    {
      id: "private_key",
      label: "Private Key Block",
      severity: "critical",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    },
    {
      id: "password_assignment",
      label: "Password / Secret Assignment",
      severity: "high",
      pattern:
        /\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?token)\s*[:=]\s*['"]?[^\s'"]{6,}['"]?/gi,
    },
    {
      id: "email",
      label: "Email Address",
      severity: "medium",
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    },
    {
      id: "phone_in",
      label: "Phone Number",
      severity: "medium",
      pattern: /(?:\+91[-\s]?)?[6-9]\d{9}\b/g,
    },
    {
      id: "aadhaar",
      label: "Aadhaar Number",
      severity: "high",
      pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      validate: (match) => {
        const digits = match.replace(/\D/g, "");
        return digits.length === 12 && !/^(\d)\1{11}$/.test(digits);
      },
    },
    {
      id: "pan",
      label: "PAN Number",
      severity: "high",
      pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    },
    {
      id: "credit_card",
      label: "Credit Card",
      severity: "critical",
      pattern: /\b(?:\d[ -]*?){13,19}\b/g,
      validate: (match) => {
        const digits = match.replace(/\D/g, "");
        if (digits.length < 13 || digits.length > 19) return false;
        return luhnCheck(digits);
      },
    },
    {
      id: "ipv4_private",
      label: "Private IP Address",
      severity: "low",
      pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})\b/g,
    },
  ];

  function luhnCheck(num) {
    let sum = 0;
    let alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function redact(value, keep = 4) {
    if (!value || value.length <= keep * 2) return "***";
    return value.slice(0, keep) + "…" + value.slice(-keep);
  }

  function findRegexFindings(text) {
    const findings = [];
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      const seen = new Set();
      while ((m = rule.pattern.exec(text)) !== null) {
        const raw = m[0];
        if (seen.has(raw)) continue;
        if (rule.validate && !rule.validate(raw)) continue;
        seen.add(raw);
        findings.push({
          id: rule.id,
          label: rule.label,
          severity: rule.severity,
          match: redact(raw),
          layer: "regex",
        });
      }
    }
    return findings;
  }

  function findFileNameFindings(text) {
    const findings = [];
    FILE_EXTENSIONS.lastIndex = 0;
    let m;
    const seen = new Set();
    while ((m = FILE_EXTENSIONS.exec(text)) !== null) {
      const name = m[0];
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      findings.push({
        id: "sensitive_filename",
        label: "Sensitive Filename",
        severity: "medium",
        match: name,
        layer: "filename",
      });
    }
    return findings;
  }

  function findCodeFindings(text) {
    const hits = SOURCE_CODE_HINTS.filter((re) => re.test(text));
    if (hits.length < 2 && text.length < 80) return [];
    if (hits.length === 0) return [];
    return [
      {
        id: "source_code",
        label: "Possible Source Code",
        severity: hits.length >= 2 ? "high" : "medium",
        match: `${hits.length} code pattern(s)`,
        layer: "heuristic",
      },
    ];
  }

  function findConfidentialHints(text) {
    const hits = CONFIDENTIAL_HINTS.filter((re) => re.test(text));
    if (!hits.length) return [];
    return [
      {
        id: "confidential_language",
        label: "Confidential Language",
        severity: "medium",
        match: `${hits.length} phrase(s)`,
        layer: "heuristic",
      },
    ];
  }

  function detectLocal(text) {
    if (!text || !text.trim()) {
      return { findings: [], score: 0, level: "none" };
    }
    const findings = [
      ...findRegexFindings(text),
      ...findFileNameFindings(text),
      ...findCodeFindings(text),
      ...findConfidentialHints(text),
    ];
    return { findings, ...scoreFindings(findings) };
  }

  function scoreFindings(findings) {
    const weights = { critical: 40, high: 25, medium: 12, low: 5 };
    let score = 0;
    for (const f of findings) score += weights[f.severity] || 5;
    score = Math.min(100, score);
    let level = "none";
    if (score >= 70) level = "block";
    else if (score >= 35) level = "warn";
    else if (score > 0) level = "info";
    return { score, level };
  }

  function maskSensitive(text) {
    let out = text;
    const maskers = [
      [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, "[AWS_KEY_REDACTED]"],
      [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[API_KEY_REDACTED]"],
      [/\bAIza[0-9A-Za-z_-]{35}\b/g, "[GOOGLE_KEY_REDACTED]"],
      [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]"],
      [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[AADHAAR_REDACTED]"],
      [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[PAN_REDACTED]"],
      [/\b(?:\d[ -]*?){13,19}\b/g, (m) => (luhnCheck(m.replace(/\D/g, "")) ? "[CARD_REDACTED]" : m)],
    ];
    for (const [re, repl] of maskers) out = out.replace(re, repl);
    return out;
  }

  global.ShadowDetectors = {
    detectLocal,
    scoreFindings,
    maskSensitive,
    RULES,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
