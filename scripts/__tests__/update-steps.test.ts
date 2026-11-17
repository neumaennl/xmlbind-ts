import { installNode, runWith } from "../lib/node-setup.ts";
import { offerSteps } from "../lib/update-steps.ts";
import { restoreTerminal, stubTerminal } from "./testHelpers.ts";

vi.mock("../lib/node-setup.ts", () => ({ installNode: vi.fn(), runWith: vi.fn() }));

const STEPS = ["npm install", "npm run lint", "npm test"];
const PRINTED = "Install and use Node 24.21.0, then run:\n  npm install\n  npm run lint\n  npm test";

const asker = { question: vi.fn<(query: string) => Promise<string>>() };

beforeEach(() => {
  stubTerminal(true);
  asker.question.mockReset();
  vi.mocked(installNode).mockReset();
  vi.mocked(runWith).mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  restoreTerminal();
  vi.restoreAllMocks();
});

describe("update-steps", () => {
  describe("offerSteps", () => {
    test("should print the steps without asking if there is no terminal", async () => {
      stubTerminal(false);

      await expect(offerSteps(asker, "24.21.0")).resolves.toBe(0);
      expect(asker.question).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(PRINTED);
      expect(installNode).not.toHaveBeenCalled();
    });

    test("should print the steps if the answer is no", async () => {
      asker.question.mockResolvedValue(" No ");

      await expect(offerSteps(asker, "24.21.0")).resolves.toBe(0);
      expect(asker.question).toHaveBeenCalledWith(
        "Install Node 24.21.0 and run npm install, npm run lint, npm test now? [Y/n] "
      );
      expect(console.log).toHaveBeenCalledWith(PRINTED);
      expect(installNode).not.toHaveBeenCalled();
    });

    test.each(["", "y"])("should install the version and run the steps with it if the answer is %j", async (answer) => {
      asker.question.mockResolvedValue(answer);
      vi.mocked(installNode).mockReturnValue("/node/24.21.0/bin");
      vi.mocked(runWith).mockReturnValue(0);

      await expect(offerSteps(asker, "24.21.0")).resolves.toBe(0);
      expect(installNode).toHaveBeenCalledWith("24.21.0");
      expect(runWith).toHaveBeenCalledWith("/node/24.21.0/bin", STEPS);
    });

    test("should print the steps and return 1 if the version cannot be installed", async () => {
      asker.question.mockResolvedValue("");
      vi.mocked(installNode).mockReturnValue(undefined);

      await expect(offerSteps(asker, "24.21.0")).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith("Could not install Node 24.21.0 with nvm, nvm-windows or fnm.");
      expect(console.log).toHaveBeenCalledWith(PRINTED);
      expect(runWith).not.toHaveBeenCalled();
    });

    test("should return the exit code of a failed step", async () => {
      asker.question.mockResolvedValue("");
      vi.mocked(installNode).mockReturnValue("/node/24.21.0/bin");
      vi.mocked(runWith).mockReturnValue(3);

      await expect(offerSteps(asker, "24.21.0")).resolves.toBe(3);
    });
  });
});
