## Welcome to [FFmpeg](https://www.ffmpeg.org/)

Hi @${username},

This is the FFmpeg Code Bot for GitHub, which enables sending of patch series to the FFmpeg mailing list from GitHub Pull Requests. It is an adaption of [GitGitGadget](https://gitgitgadget.github.io/) and credits belong to its creators.

You are here to submit a contribution to FFmpeg? That's great!
We try to make that process as easy and straightworward as possible, but there are still a number of things to consider. 


### Prerequisites

First of all, make sure that you have read the through the [Devloper Documentation](https://www.ffmpeg.org/developer.html)


Please make sure that your Pull Request has a good description, as it will be used as cover letter.

Also, it is a good idea to review the commit messages one last time, as the FFmpeg project expects them in a quite specific form:

* the lines should not exceed 76 columns,
* the first line should be like a header and typically start with a prefix like "tests:" or "revisions:" to state which subsystem the change is about, and
* the commit messages' body should be describing the "why?" of the change.
* Finally, the commit messages should end in a [Signed-off-by:](https://git-scm.com/docs/SubmittingPatches#dco) line matching the commits' author.

It is in general a good idea to await the automated test ("Checks") in this Pull Request before contributing the patches, e.g. to avoid trivial issues such as unportable code.

### Submitting your Patchset

Before you can submit the patches, your GitHub username needs to be added to the list of permitted users. Any already-permitted user can do that, by adding a comment to your PR of the form `/allow`. A good way to find other contributors is to locate recent pull requests where someone has been `/allow`ed:

* [Search: is:pr is:open "/allow"](https://github.com/ffstaging/FFmpeg/pulls?utf8=%E2%9C%93&q=is%3Apr+is%3Aopen+%22%2Fallow%22)

Both the person who commented `/allow` and the PR author are able to `/allow` you.

An alternative is the channel [`#ffmpeg-devel`](https://www.ffmpeg.org/developer.html) on the Libera Chat IRC network:

    <newcontributor> I've just created my first PR, could someone please /allow me? https://github.com/ffstaging/FFmpeg/pull/12345
    <veteran> newcontributor: it is done
    <newcontributor> thanks!

Once on the list of permitted usernames, you can contribute the patches to the Git mailing list by adding a PR comment `/submit`.

If you want to see what email(s) would be sent for a `/submit` request, add a PR comment `/preview` to have the email(s) sent to you.  You must have a public GitHub email address for this.

After you submit, the Code Bot will respond with another comment that contains the link to the cover letter mail in the FFmpeg mailing list archive. Please make sure to monitor the discussion in that thread and to address comments and suggestions (while the comments and suggestions will be mirrored into the PR by the Code Bot, you will still want to [reply via mail](https://github.com/ffstaging/FFmpeg/wiki/Reply-To-This)).

### Submitting Revised Patch Versions
To iterate on your change, i.e. send a revised patch or patch series, you will first want to (force-)push to the same branch. You probably also want to modify your Pull Request description (or title). It is a good idea to summarize the revision by adding something like this to the cover letter (read: by editing the first comment on the PR, i.e. the PR description):

```
Changes since v1:
- Fixed a typo in the commit message (found by ...)
- Added a code comment to ... as suggested by ...
...
```

To send a new iteration, just add another PR comment with the contents: `/submit`.

### Further Reference

- [Documentation](https://www.ffmpeg.org/documentation.html)
- [Mailing Lists](https://www.ffmpeg.org/contact.html)
- [Wiki](https://trac.ffmpeg.org/)
- [Bug Tracker](https://trac.ffmpeg.org/report)
- [Patchwork CI](https://patchwork.ffmpeg.org/project/ffmpeg/list/)
- [IRC - #ffmpeg-devel](https://web.libera.chat/#ffmpeg-devel)

### Bot Interaction

I'm the interactive FFmpeg Code Bot for GitHub. My elder brother [GitGitGadget](https://gitgitgadget.github.io/) is assisting in development of [GIT itself](https://github.com/git/git).
Credits are due to my original creators at [GitGitGadget](https://github.com/gitgitgadget/gitgitgadget).

##### Did you know?

You can post a comment containing `/help` to get a list of commands that I understand.  
