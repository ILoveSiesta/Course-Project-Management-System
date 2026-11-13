"""Offline checks for the GitHub workflow files used by the Lab 5 pipeline (#21).

Standard library only (CI runs this with `python3 -m unittest discover -s deploy/tests`).
The checks guard the values that must match other places exactly:
  - the GitHub environment `demo` and `.github/workflows/deploy.yml` (both are part of the
    Workload Identity Federation condition from Student Guide 6.3),
  - the CPMS resource names used by deploy/release.sh,
  - Dependabot limited to GitHub Actions, as in the starter kit.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
DEPLOY_YML = WORKFLOWS / "deploy.yml"
CI_YML = WORKFLOWS / "ci-docker.yml"
DEPENDABOT_YML = ROOT / ".github" / "dependabot.yml"


def code_lines(path: Path) -> str:
    """File content without full-line comments, so explanations do not count as config."""
    lines = path.read_text(encoding="utf-8").splitlines()
    return "\n".join(line for line in lines if not line.lstrip().startswith("#"))


class DeployWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue(DEPLOY_YML.is_file(), f"missing {DEPLOY_YML.relative_to(ROOT)}")
        self.text = code_lines(DEPLOY_YML)

    def test_runs_on_push_to_main_and_manual_rollback(self):
        self.assertRegex(self.text, r"push:\s*\n\s*branches:\s*\[main\]")
        self.assertIn("workflow_dispatch:", self.text)
        self.assertIn("image_tag:", self.text)

    def test_reuses_ci_before_deploying(self):
        self.assertIn("uses: ./.github/workflows/ci-docker.yml", self.text)
        self.assertIn("needs: test", self.text)
        self.assertIn("needs.test.result == 'success'", self.text)

    def test_uses_environment_demo_and_keyless_auth(self):
        self.assertRegex(self.text, r"(?m)^\s*environment:\s*demo\s*$")
        self.assertIn("id-token: write", self.text)
        for name in ("GCP_PROJECT_ID", "GCP_REGION", "WIF_PROVIDER", "WIF_SERVICE_ACCOUNT"):
            self.assertIn(f"vars.{name}", self.text)
        self.assertNotRegex(self.text, r"credentials_json|GOOGLE_APPLICATION_CREDENTIALS")

    def test_uses_cpms_resource_names(self):
        self.assertRegex(self.text, r"SERVICE_NAME:\s*cpms\s*\n")
        self.assertIn("MIGRATE_JOB_NAME: cpms-migrate", self.text)
        self.assertIn('-docker.pkg.dev/$PROJECT_ID/cpms/cpms:$IMAGE_TAG"', self.text)
        self.assertNotRegex(self.text.lower(), r"toktickit|categories")

    def test_pushes_a_single_image_manifest(self):
        # Without these flags the runner's docker build pushes an OCI image index with a
        # provenance attestation; release.sh then records the index digest while Cloud Run
        # serves the platform manifest digest, so they differ (Student Guide 7.6 needs them equal).
        build = re.search(r"docker build [^\n]*", self.text)
        self.assertIsNotNone(build, "docker build step not found")
        self.assertIn("--provenance=false", build.group(0))
        self.assertIn("--sbom=false", build.group(0))

    def test_validates_full_sha_and_calls_release_and_smoke_scripts(self):
        self.assertIn("^[0-9a-f]{40}$", self.text)
        self.assertIn("bash deploy/release.sh", self.text)
        self.assertIn('python3 deploy/smoke_test.py "$SERVICE_URL"', self.text)
        self.assertIn("$DEPLOYED_IMAGE", self.text)

    def test_actions_are_pinned_to_full_commit_sha(self):
        uses = re.findall(r"uses:\s*([^\s#]+)", self.text)
        external = [u for u in uses if not u.startswith("./")]
        self.assertTrue(external, "no external actions found")
        for ref in external:
            self.assertRegex(ref, r"@[0-9a-f]{40}$", f"not pinned to a commit SHA: {ref}")


class CiWorkflowTest(unittest.TestCase):
    def test_ci_is_reusable_and_keeps_required_job_name(self):
        text = code_lines(CI_YML)
        self.assertIn("workflow_call:", text)
        self.assertRegex(text, r"(?m)^  test-and-docker:\s*$")


class DependabotTest(unittest.TestCase):
    def test_only_github_actions_updates(self):
        text = code_lines(DEPENDABOT_YML)
        ecosystems = re.findall(r'package-ecosystem:\s*"?([\w-]+)"?', text)
        self.assertEqual(ecosystems, ["github-actions"])


if __name__ == "__main__":
    unittest.main()
