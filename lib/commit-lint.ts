import { IPRCommit } from "./github-glue";

export interface ILintError {
    checkFailed: boolean;           // true if check failed
    message: string;
}

/*
 * Simple class to drive lint tests on commit messages.
 */
export class LintCommit {
    private blocked: boolean;
    private lines: string[];
    private patch: IPRCommit;
    private messages: string[] = [];

    public constructor(patch: IPRCommit) {
        this.blocked = false;
        this.lines =  patch.message.split("\n");
        this.patch = patch;
    }

    /*
     * Linter method to run checks on the commit message.
     * @param {IPRCommit} the patch to be checked
     *
     * The lints are in methods called from here.  If
     * a lint check is too severe to continue, it will throw
     * an error.
     */
    public lint(): ILintError | void {

        // Basic test before all others

        this.commitMessageLength();
        this.bangPrefix();
        this.lowerCaseAfterPrefix();
        this.signedOffBy();
        this.moreThanAHyperlink();

        if (this.messages.length) {
            return { checkFailed: this.blocked,
                     message: `There ${this.messages.length > 1 ?
                     "are issues" : "is an issue"} in commit ${
                     this.patch.commit}:\n${this.messages.join("\n")}`,
                };
        }
    }

    private addMessage(message: string): void {
        this.messages.push(message);
    }

    private block(message: string): void {
        this.blocked = true;
        this.addMessage(message);
    }

    // More tests of the commit message structure.
    // - the first line should not exceed 76 characters
    // - the first line should be followed by an empty line

    private commitMessageLength(): void {
        const maxColumns = 76;
        if (this.lines[0].length > maxColumns) {
            this.block(`First line of commit message is too long (> ${
                maxColumns} columns): ${this.lines[0]}`);
        }

        if (this.lines[1].length) {
            this.block("The first line must be separated from the rest by an "
                        + "empty line");
        }
    }

    // Verify if the first line starts with a prefix (e.g. tests:), it continues
    // in lower-case (except for ALLCAPS as that is likely to be a code
    // identifier)

    private lowerCaseAfterPrefix(): void {
        const match = this.lines[0].match(/^\S+?:\s*?([A-Z][a-z ])/);

        if (match) {
            this.block(`Prefixed commit message must be in lower case: ${
                       this.lines[0]}`);
        }
    }

    // Reject commits that appear to require rebasing

    private bangPrefix(): void {
        if (this.lines[0].match(/^(squash|fixup|amend)!/)) {
            this.block(`Rebase needed to squash commit: ${this.lines[0]}`);
        }
    }

    // Verify there is a Signed-off-by: line - DCO check does this
    // already, but put out a message if it is indented

    private signedOffBy(): void {
        let signedFound = false;

        this.lines.map((line) => {
            const match = line.match(/^(\s*)Signed-off-by:\s+(.*)/);

            if (match) {
                signedFound = true;
                if (match[1].length) {
                    this.block(`Leading whitespace in sign off: ${line}`);
                }
            }
        });

        if (!signedFound) {
            this.block("Commit not signed off");
        }
    }

    // Verify the body of the commit message does not consist of a hyperlink,
    // without any other explanation.
    // Should all lines be checked ie is it an array of links?
    // Low hanging fruit: check the first line.
    // Hyperlink validation is NOT part of the test.

    private moreThanAHyperlink(): void {
        const line = this.lines[2];
        const match = line.match(/^(\w*)\s*https*:\/\/\S+\s*(\w*)/);

        if (match) {
            if (!match[1].length && !match[2].length &&
                this.lines.length === 5) {
                this.block("A hyperlink requires some explanation");
            }
        }
    }
}
