"""
Shadow AI Radar — local Python detection layer (regex + filename + heuristics).

Use for CLI testing or as a future localhost API that the extension can call.
Does not send prompts anywhere.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from typing import Callable, Optional


@dataclass
class Finding:
    id: str
    label: str
    severity: str
    match: str
    layer: str


def _redact(value: str, keep: int = 4) -> str:
    if not value or len(value) <= keep * 2:
        return "***"
    return f"{value[:keep]}…{value[-keep:]}"


def _luhn(num: str) -> bool:
    digits = [int(c) for c in num if c.isdigit()]
    if not (13 <= len(digits) <= 19):
        return False
    total = 0
    alt = False
    for d in reversed(digits):
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


RULES: list[tuple[str, str, str, re.Pattern[str], Optional[Callable[[str], bool]]]] = [
    ("aws_access_key", "AWS Access Key", "critical", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b"), None),
    ("openai_key", "OpenAI API Key", "critical", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), None),
    ("openrouter_key", "OpenRouter API Key", "critical", re.compile(r"\bsk-or-v1-[A-Za-z0-9]{20,}\b"), None),
    ("google_api_key", "Google API Key", "critical", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), None),
    ("github_token", "GitHub Token", "critical", re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b"), None),
    ("private_key", "Private Key Block", "critical", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), None),
    (
        "password_assignment",
        "Password / Secret Assignment",
        "high",
        re.compile(
            r"\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?token)\s*[:=]\s*['\"]?[^\s'\"]{6,}['\"]?",
            re.I,
        ),
        None,
    ),
    ("email", "Email Address", "medium", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), None),
    ("phone_in", "Phone Number", "medium", re.compile(r"(?:\+91[-\s]?)?[6-9]\d{9}\b"), None),
    (
        "aadhaar",
        "Aadhaar Number",
        "high",
        re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
        lambda m: len(re.sub(r"\D", "", m)) == 12 and not re.fullmatch(r"(\d)\1{11}", re.sub(r"\D", "", m)),
    ),
    ("pan", "PAN Number", "high", re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), None),
    (
        "credit_card",
        "Credit Card",
        "critical",
        re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
        lambda m: _luhn(re.sub(r"\D", "", m)),
    ),
]

FILE_RE = re.compile(
    r"\b[\w.-]+\.(env|pem|key|p12|pfx|crt|cer|jks|kdbx|sql|dump|bak|csv|xlsx?|docx?|pdf|json|ya?ml|toml|ini|cfg|conf|properties|tfvars|keystore)\b",
    re.I,
)

CODE_HINTS = [
    re.compile(r"\b(class|function|def|import|from|package|namespace|public static|private static)\b"),
    re.compile(r"\b(SELECT|INSERT|UPDATE|DELETE|DROP)\s+.+\b(FROM|INTO|TABLE|SET)\b", re.I),
    re.compile(r"\b(const|let|var)\s+\w+\s*="),
    re.compile(r"```[\s\S]{20,}```"),
    re.compile(r"\b(React|useState|useEffect|express\(\)|app\.get\(|fastapi|django)\b", re.I),
]

CONF_HINTS = [
    re.compile(r"\b(confidential|internal only|do not share|trade secret|client database|roadmap|salary|ssn|nda)\b", re.I),
    re.compile(r"\b(prod(uction)?\s+(db|database|password|secret|key|credential)s?)\b", re.I),
    re.compile(r"\b(employee\s+(list|data|records)|payroll|hr\s+document)\b", re.I),
]

WEIGHTS = {"critical": 40, "high": 25, "medium": 12, "low": 5}


def detect(text: str) -> dict:
    findings: list[Finding] = []

    for fid, label, severity, pattern, validate in RULES:
        for m in pattern.finditer(text or ""):
            raw = m.group(0)
            if validate and not validate(raw):
                continue
            findings.append(Finding(fid, label, severity, _redact(raw), "regex"))

    for m in FILE_RE.finditer(text or ""):
        findings.append(Finding("sensitive_filename", "Sensitive Filename", "medium", m.group(0), "filename"))

    code_hits = sum(1 for r in CODE_HINTS if r.search(text or ""))
    if code_hits:
        findings.append(
            Finding(
                "source_code",
                "Possible Source Code",
                "high" if code_hits >= 2 else "medium",
                f"{code_hits} code pattern(s)",
                "heuristic",
            )
        )

    conf_hits = sum(1 for r in CONF_HINTS if r.search(text or ""))
    if conf_hits:
        findings.append(
            Finding(
                "confidential_language",
                "Confidential Language",
                "medium",
                f"{conf_hits} phrase(s)",
                "heuristic",
            )
        )

    # de-dupe by id+match
    uniq: dict[tuple[str, str], Finding] = {}
    for f in findings:
        uniq[(f.id, f.match)] = f
    findings = list(uniq.values())

    score = min(100, sum(WEIGHTS.get(f.severity, 5) for f in findings))
    if any(f.severity == "critical" for f in findings):
        level = "block"
        score = max(score, 80)
    elif score >= 70:
        level = "block"
    elif score >= 35:
        level = "warn"
    elif score > 0:
        level = "info"
    else:
        level = "none"

    return {
        "score": score,
        "level": level,
        "action": "prompt" if level in ("block", "warn") else "allow",
        "findings": [asdict(f) for f in findings],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Shadow AI Radar local detector")
    parser.add_argument("text", nargs="?", help="Prompt text to analyze")
    parser.add_argument("-f", "--file", help="Read prompt from file")
    args = parser.parse_args()

    if args.file:
        with open(args.file, "r", encoding="utf-8") as fh:
            text = fh.read()
    elif args.text:
        text = args.text
    else:
        text = input("Paste prompt:\n")

    result = detect(text)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
