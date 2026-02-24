// @ts-expect-error user needs to install @e2b/code-interpreter manually due to "Ask First" policy
import { Sandbox } from '@e2b/code-interpreter';

export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  error?: string;
  results?: unknown[];
}

export class E2BSandboxService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.E2B_API_KEY;
  }

  /**
   * Executes Python code inside a secure E2B sandbox environment.
   */
  async executePythonCode(code: string, timeoutMs: number = 60000): Promise<SandboxExecutionResult> {
    if (!this.apiKey) {
      throw new Error("E2B_API_KEY is not defined. Cannot execute code in sandbox.");
    }

    let sandbox: Sandbox | null = null;
    try {
      sandbox = await Sandbox.create({
        apiKey: this.apiKey,
      });

      const execution = await sandbox.runCode(code, {
        timeoutMs
      });

      return {
        stdout: execution.logs.stdout.join('\n'),
        stderr: execution.logs.stderr.join('\n'),
        results: execution.results,
        error: execution.error ? execution.error.value : undefined,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: '',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (sandbox) {
        await sandbox.close();
      }
    }
  }

  /**
   * Run a terminal command inside the E2B sandbox.
   */
  async runCommand(command: string): Promise<SandboxExecutionResult> {
    if (!this.apiKey) {
      throw new Error("E2B_API_KEY is not defined. Cannot execute command in sandbox.");
    }

    let sandbox: Sandbox | null = null;
    try {
      sandbox = await Sandbox.create({
        apiKey: this.apiKey,
      });

      const process = await sandbox.commands.run(command);
      
      return {
        stdout: process.stdout,
        stderr: process.stderr,
        error: process.error ? process.error.message : undefined,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: '',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (sandbox) {
        await sandbox.close();
      }
    }
  }
}
