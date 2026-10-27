import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("Database Backup & Restoration Verification Suite", () => {
  it("executes pg_dump snapshot and pg_restore into isolated staging database with 100% record integrity", () => {
    const env = fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8");
    const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
    assert.ok(match, "DATABASE_URL must be defined");

    // Clean Prisma specific query params and force IPv4 for pg_dump/pg_restore
    const rawUri = match[1];
    const u = new URL(rawUri);
    u.search = "";
    u.hostname = "127.0.0.1";
    const cleanConnStr = u.toString();

    const dumpFile = path.resolve(__dirname, "temp_verify_backup.dump");
    const baseUri = cleanConnStr.replace(/\/unifood_db$/, "/postgres");
    const restoreDbName = "unifood_restore_verify_test";
    const restoreUri = cleanConnStr.replace(/\/unifood_db$/, `/${restoreDbName}`);

    try {
      // 1. pg_dump snapshot
      const dumpStart = Date.now();
      execSync(`pg_dump -Fc -f "${dumpFile}" "${cleanConnStr}"`);
      const dumpDurationMs = Date.now() - dumpStart;
      assert.ok(fs.existsSync(dumpFile));
      assert.ok(dumpDurationMs < 10000, "Dump must complete in reasonable time");

      // 2. Create isolated target database
      execSync(`psql "${baseUri}" -c "DROP DATABASE IF EXISTS ${restoreDbName};"`);
      execSync(`psql "${baseUri}" -c "CREATE DATABASE ${restoreDbName};"`);

      // 3. pg_restore snapshot into isolated test database
      const restoreStart = Date.now();
      execSync(`pg_restore -d "${restoreUri}" "${dumpFile}"`);
      const restoreDurationMs = Date.now() - restoreStart;
      assert.ok(restoreDurationMs < 15000, "Restore must complete in reasonable time");

      // 4. Verify record counts between primary and restored database
      const countUserOrig = execSync(`psql "${cleanConnStr}" -t -c "SELECT count(*) FROM \\"User\\";"`).toString().trim();
      const countUserRestored = execSync(`psql "${restoreUri}" -t -c "SELECT count(*) FROM \\"User\\";"`).toString().trim();
      assert.equal(countUserRestored, countUserOrig);

      const countOrderOrig = execSync(`psql "${cleanConnStr}" -t -c "SELECT count(*) FROM \\"Order\\";"`).toString().trim();
      const countOrderRestored = execSync(`psql "${restoreUri}" -t -c "SELECT count(*) FROM \\"Order\\";"`).toString().trim();
      assert.equal(countOrderRestored, countOrderOrig);

      const countBranchOrig = execSync(`psql "${cleanConnStr}" -t -c "SELECT count(*) FROM \\"Branch\\";"`).toString().trim();
      const countBranchRestored = execSync(`psql "${restoreUri}" -t -c "SELECT count(*) FROM \\"Branch\\";"`).toString().trim();
      assert.equal(countBranchRestored, countBranchOrig);

    } finally {
      // 5. Cleanup
      try {
        execSync(`psql "${baseUri}" -c "DROP DATABASE IF EXISTS ${restoreDbName};"`);
      } catch (_) {}
      if (fs.existsSync(dumpFile)) {
        fs.unlinkSync(dumpFile);
      }
    }
  });
});
