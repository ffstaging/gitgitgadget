// @ts-check
/*
 * This is the Azure Function backing the ffgithub GitHub App.
 *
 * As Azure Functions do not support Typescript natively yet, we implement it in
 * pure Javascript and keep it as simple as possible.
 *
 * Note: while the Azure Function Runtime v1 supported GitHub webhooks natively,
 * via the "webHookType", we want to use v2, so we have to do the payload
 * validation "by hand".
 */
const crypto = require('crypto');
const https = require('https');

const http = require('http');
const hostname = 'localhost';
const port = 8082;

const server = http.createServer(async (req, res) => {

    await module.exports(req, res);
//    res.statusCode = 200;
//    res.setHeader('Content-Type', 'text/plain');
//    res.end('OK\n');
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

const validateGitHubWebHook = (req) => {
    const secret = process.env['GITHUB_WEBHOOK_SECRET'];
    if (!secret) {
        throw new Error('Webhook secret not configured');
    }
    if (req.headers['content-type'] !== 'application/json') {
        throw new Error('Unexpected content type: ' + req.headers['content-type']);
    }
    const signature = req.headers['x-hub-signature'];
    if (!signature) {
        throw new Error('Missing X-Hub-Signature');
    }
    const sha1 = signature.match(/^sha1=(.*)/);
    if (!sha1) {
        throw new Error('Unexpected X-Hub-Signature format: ' + signature);
    }
//    const computed = crypto.createHmac('sha1', secret).update(req.rawBody).digest('hex');
//    if (sha1[1] !== computed) {
//        throw new Error('Incorrect X-Hub-Signature');
//    }
}

const triggerAzurePipeline = async (token, organization, project, buildDefinitionId, sourceBranch, parameters, logcont) => {
    const auth = Buffer.from('PAT:' + token).toString('base64');
    const headers = {
        'Accept': 'application/json; api-version=5.0; excludeUrls=true',
        'Authorization': 'Basic ' + auth,
    };
    const json = JSON.stringify({
        'definition': { 'id': buildDefinitionId },
        'sourceBranch': sourceBranch,
        'parameters': JSON.stringify(parameters),
    });
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(json);

    const requestOptions = {
        host: 'dev.azure.com',
        port: '443',
        path: `/${organization}/${project}/_apis/build/builds?ignoreWarnings=false&api-version=5.0`,
        method: 'POST',
        headers: headers
    };

    logcont.log += requestOptions.path + '\n';

    return new Promise((resolve, reject) => {
        const handleResponse = (res, err) => {
            res.setEncoding('utf8');
            var response = '';
            res.on('data', (chunk) => {
                response += chunk;
            });
            res.on('end', () => {
                logcont.log += 'triggerAzurePipeline response: ' + response + '\n';
                console.log('triggerAzurePipeline response: ' + response);
                resolve(JSON.parse(response));
            });
            res.on('triggerAzurePipeline error: ' + err,
                (err) => {
                    logcont.log += 'triggerAzurePipeline error: ' + err + '\n';
                    console.log(err);
                    reject(err);
                });
        };

        const request = https.request(requestOptions, handleResponse);
        request.write(json);
        request.end();
    });
}

const getBody = async (req) => {

    return new Promise((resolve, reject) => {
        req.setEncoding('utf8');
        let body = ""; 
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {

    console.log(req);

    try {
        validateGitHubWebHook(req);
    } catch (e) {
        console.log('Caught ' + e);

        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not a valid GitHub webhook: ' + e);
        return;
    }

    try {
        /*
         * The Azure Pipeline needs to be installed as a PR build on _the very
         * same_ repository that triggers this function. That is, when the
         * Azure Function triggers GitGitGadget for gitgitgadget/git, it needs
         * to know that pipelineId 3 is installed on gitgitgadget/git, and
         * trigger that very pipeline.
         *
         * So whenever we extend GitGitGadget to handle another repository, we
         * will have to add an Azure Pipeline, install it on that repository as
         * a PR build, and add the information here.
         */
        const pipelines = {
            'FFmpeg': 1,
            'ffstaging': 1
        };

        console.log('Check 1');

        let bodyString = await getBody(req);

        if (!bodyString || bodyString.length === 0) {
            throw new Error('The request body is empty');
        }

        let body = JSON.parse(bodyString);

        console.log('Check 1b');

        console.log(body);

        res.setHeader('Content-Type', 'text/plain');

        const eventType = req.headers['x-github-event'];
        console.log(`Got eventType: ${eventType}`);
        const repositoryOwner = body.repository.owner.login;
        if (pipelines[repositoryOwner] === undefined) {

            res.statusCode = 403;
            res.end('Refusing to work on a repository other than ffstaging/FFmpeg or FFmpeg/FFmpeg');
            return;

        } else if ((new Set(['check_run', 'status']).has(eventType)))
        {
            res.statusCode = 200;
            res.end(`Ignored event type: ${eventType}`);
            return;

        } else if (eventType === 'issue_comment') {

            console.log('Check 2');

            const triggerToken = process.env['GITGITGADGET_TRIGGER_TOKEN'];
            if (!triggerToken) {
                throw new Error('No configured trigger token');
            }

            const comment = body.comment;
            const prNumber = body.issue.number;
            if (!comment || !comment.id || !prNumber) {
                console.log(`Invalid payload:\n${JSON.stringify(bodyString, null, 4)}`);
                throw new Error('Invalid payload');
            }

            /////* GitGitGadget works on dscho/git only for testing */
            ////if (repositoryOwner === 'dscho' && comment.user.login !== 'dscho') {
            ////    throw new Error(`Ignoring comment from ${comment.user.login}`);
            ////}

            /* Only trigger the Pipeline for valid commands */
            if (!comment.body || !comment.body.match(/^\/(submit|preview|allow|disallow|test|cc|help)\b/)) {

                res.end(`Not a command: '${comment.body}'`);
                return;
            }

            console.log('Check 3');

            const sourceBranch = `refs/pull/${prNumber}/head`;
            const parameters = {
                'pr.comment.id': comment.id,
            };
            const pipelineId = pipelines[repositoryOwner];
            if (!pipelineId || pipelineId < 1)
                throw new Error(`No pipeline set up for org ${repositoryOwner}`);
            console.log(`Queuing with branch ${sourceBranch} and parameters ${JSON.stringify(parameters)}`);
            let logcont = { log: 'a' };

            await triggerAzurePipeline(triggerToken, 'githubsync', 'FFmpeg', pipelineId, sourceBranch, parameters, logcont);

            ////res.end(`OK. Log: ` + logcont.log);
            res.end(`OK.`);

        } else {

            res.end('No idea what this is about, but okay.');

            console.log(`Unhandled request:\n${JSON.stringify(req, null, 4)}`);
        }
    } catch (e1) {
        console.log('Caught exception ' + e1);
        res.statusCode = 500;
        res.end('Caught an error: ' + e1);
    }
};
