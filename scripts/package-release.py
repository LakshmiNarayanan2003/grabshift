"""Create the complete source release with a grabshift/ root directory."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
excluded = {
    ".git", "node_modules", "dist", "test-results", "playwright-report",
    "coverage", ".cache", "__pycache__", ".venv",
}
archive = root / "grabshift.zip"
files = sorted(
    path for path in root.rglob("*")
    if path.is_file()
    and not excluded.intersection(path.relative_to(root).parts)
    and path.suffix not in {".zip", ".log", ".pyc"}
    and not path.name.startswith(".env")
)
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for path in files:
        if path.is_symlink():
            raise RuntimeError(f"Do not package symlinks: {path}")
        output.write(path, Path("grabshift") / path.relative_to(root))
with zipfile.ZipFile(archive) as output:
    if output.testzip() is not None:
        raise RuntimeError("ZIP integrity check failed")
archive.chmod(0o644)
print(f"Created {archive.name}: {len(files)} files, {archive.stat().st_size} bytes")
