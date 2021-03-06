
import git from "simple-git/promise";
import { Client } from '@elastic/elasticsearch';
import  { elasticsearchEnv } from '../es_config';
import fs from 'fs';
import path from 'path';
import find from 'find';
import sloc from 'sloc';
import tmp from 'tmp';
import { BasicPluginInfo, getPluginInfoForRepo, getTeamOwner, getPluginForPath } from "../plugin_utils";
import { getIndexName, indexDocs } from "../es_utils";
import { repo } from './config';
import { checkoutRepo, checkoutRoundedDate, getCheckoutDates, getCommitDate } from "../git_utils";

const client = new Client(elasticsearchEnv);

const fileExtensions = [".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss"];

function findFiles(dir: string) {
  return new Promise<string[]>(resolve => {
    find.file(dir, files => {
      resolve(files);
    });
  });
}

interface AnalyzedFile {
  hasAngular: boolean;
  hasUiPublic: boolean;
  ext: string;
  filename: string;
  isTestFile: boolean;
  dirs: string;
  fullFilename: string;
  anyCount: number;
  teamOwner: string;
  loc: number;
  anyCountOverLoc: number;
  plugin: string;
}

interface FileDocAttributes extends AnalyzedFile {
  commitHash: string;
  commitDate: string,
  repo: string,
  indexDate: string;
};

function filterFile(file: string) {
  return (
    fileExtensions.indexOf(path.extname(file)) !== -1 &&
    !file.includes('node_modules') &&
    !file.includes('optimize/bundles') &&
    !file.includes('x-pack/build') &&
    !file.includes('target/')
  );
}


async function analyze(localPath: string, plugins: Array<BasicPluginInfo>) {
  console.log(`Analyzing ${localPath}`);

  const rootDirDepth = localPath.split(path.sep).length;
  const files = await findFiles(localPath);
  return files
    .filter(file => filterFile(file))
    .map(file => {
      const code = fs.readFileSync(file, { encoding: "utf8" });
      const dirs = file.split(path.sep).slice(rootDirDepth);
      const filename = dirs.pop();
      if (filename) {
        const ext = path.extname(filename).slice(1);
        
        const angularTakeaways = [
          "uiModules",
          ".directive(",
          ".service(",
          ".controller(",
          "$scope",
          "Private(",
          "dangerouslyGetActiveInjector",
        ];

        const plugin = getPluginForPath(file, plugins);
        const teamOwner = getTeamOwner(file, plugins);
        const anyCount = (code.match(/: any/g) || []).length;
        const loc = (code.match(/\n/g) || []).length;

        const attributes: AnalyzedFile = {
          ...sloc(code, ext),
          isTestFile:
            dirs.includes("__tests__") || filename.indexOf(".test.") > -1 || teamOwner === 'kibana-qa' || dirs.includes('test') || dirs.includes('test_utils'),
          ext,
          filename,
          plugin: plugin ? plugin.name : 'noPlugin',
          teamOwner: plugin && plugin?.teamOwner ? plugin.teamOwner : 'noOwner',
          anyCount,
          loc,
          anyCountOverLoc: anyCount/loc,
          dirs: dirs.join(path.sep),
          fullFilename: [...dirs, filename].join(path.sep),
          hasAngular: angularTakeaways.some(searchString =>
            code.includes(searchString)
          ),
          hasUiPublic: code.includes("from 'ui/")
        };
        return attributes;
      }
    });
}

async function alreadyIndexed(repo: string, commitHash: string) {

	// @ts-ignore
  const entries = await client.search({
    index: getIndexName('code', repo),
    ignoreUnavailable: true,
    size: 0,
    body: {
      query: {
        bool: {
          filter: [{ match: { commitHash } }, { match: { repo } }]
        }
      }
    }
  });

	// @ts-ignore
  return entries.hits.total > 0;
}

const getDocument = (commitHash: string, commitDate: string, repo: string) => (file: AnalyzedFile | undefined) => {
  if (file) {
    return {
      ...file,
      commitHash,
      commitDate,
      repo,
      indexDate: new Date().toISOString()
    };
  }
};

async function indexFiles(
    files:  Array<FileDocAttributes | undefined>,
    repo: string,
    commitHash: string,
    commitDate: string,
    checkoutDate?: string) {
  await indexDocs<FileDocAttributes | undefined>(
    client,
    files,
    commitHash,
    commitDate,
    getIndexName('code', repo),
    (doc) => doc ? `${checkoutDate}${commitHash}${doc.fullFilename.replace('/', '')}` : '',
    checkoutDate);
  
  await indexDocs<FileDocAttributes | undefined>(
    client,
    files,
    commitHash,
    commitDate,
    `${getIndexName('code', repo)}-latest`,
    (doc) => doc ? `${doc.fullFilename.replace('/', '')}` : '');
}

export async function crawlCode() {
  const { repoPath, currentGit } = await checkoutRepo(repo, process.env.LOCAL_REPO_DIR);
  try {
    for (const date of getCheckoutDates()) {
      const commitHash = await checkoutRoundedDate(repoPath, currentGit, date);
      const commitDate = await getCommitDate(currentGit);
      // if (await alreadyIndexed(repo, commitHash)) {
      //   console.log(
      //     `${repo} ${checkout} (${commitHash}) already indexed, skipping`
      //   );
      //   continue;
      // }

      console.log('Hash is ' + commitHash + ' and date is ' + commitDate);
      const plugins = getPluginInfoForRepo(repoPath);

      let files: Array<FileDocAttributes | undefined> = [];
      
      const analyzedFiles = await analyze(repoPath, plugins);
      
      for (let i = 0; i < analyzedFiles.length; i++) {
        const file = getDocument(commitHash, commitDate, repo)(analyzedFiles[i]);
        files.push(file);
        if (files.length === 500) {
          await indexFiles(files, repo, commitHash, commitDate, date);
          files = [];
        }
      }
      await indexFiles(files, repo, commitHash, commitDate, date);
    }
  } catch (e) {
    console.log(`Indexing ${repo} failed: `, e);
  }
}
