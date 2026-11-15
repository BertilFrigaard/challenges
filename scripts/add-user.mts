import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "@node-rs/argon2";
import pg from "pg";

// Reads a line from the terminal without echoing what is typed.
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(question);
    let input = "";

    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(input);
          return;
        }
        if (char === "\u0003") {
          // Ctrl+C
          cleanup();
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") {
          input = input.slice(0, -1);
        } else if (char >= " ") {
          input += char;
        }
      }
    };

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!stdin.isTTY) fail("add-user must be run in an interactive terminal.");

const rl = createInterface({ input: stdin, output: stdout });
const username = (await rl.question("Username: ")).trim();
rl.close();
if (!username) fail("Username cannot be empty.");

const password = await promptHidden("Password: ");
if (!password) fail("Password cannot be empty.");
const confirmation = await promptHidden("Confirm password: ");
if (password !== confirmation) fail("Passwords do not match.");

// Argon2id with the library's defaults; the result encodes salt and parameters.
const passwordHash = await hash(password);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rows } = await client.query<{ id: string }>(
    "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
    [username, passwordHash],
  );
  console.log(`Created user "${username}" (${rows[0].id}).`);
} catch (err) {
  if ((err as { code?: string }).code === "23505") {
    console.error(`Username "${username}" already exists.`);
  } else {
    console.error("Failed to create user:", (err as Error).message);
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
