import  elasticsearch from 'elasticsearch';
import  { elasticsearchEnv } from '../../config';

import { getPluginInfoForRepo } from "../../plugin_utils";
import { referenceIndexMapping, refsIndexName } from "../reference_doc";
import { createIndex } from "../../es_utils";
import { getCheckoutDates, repo } from "../config";
import { checkoutRepo, checkoutRoundedDate, getCommitDate, getCommitHash } from "../../git_utils";
import { Project, SourceFile } from 'ts-morph';
import { getContractApi } from '../../api_utils';
import { indexApiReferences } from '../index_api_references';

const client = new elasticsearch.Client(elasticsearchEnv);

export async function crawlContractReferences() {
  const { repoPath, currentGit } = await checkoutRepo(repo, process.env.LOCAL_REPO_DIR);

  await createIndex(client, refsIndexName, referenceIndexMapping);
  await createIndex(client, `${refsIndexName}-latest`, referenceIndexMapping);

  try {
    for (const date of getCheckoutDates()) {
      const commitHash = await checkoutRoundedDate(repoPath, currentGit, date);
      const commitDate = await getCommitDate(currentGit);

      await collectReferences(
        client,
        repoPath,
        `${repoPath}/x-pack/tsconfig.json`,
        commitHash,
        commitDate,
        date === undefined);
    }
  } catch (e) {
    console.log(`Indexing ${repo} failed: `, e);
  }
}

export async function collectReferences(
  client: elasticsearch.Client,
  repoPath: string,
  tsConfigFilePath: string,
  commitHash: string,
  commitDate: string,
  indexAsLatest: boolean) {
  const project = new Project({ tsConfigFilePath });
  const plugins = getPluginInfoForRepo(repoPath);

  const sourceFiles = project.getSourceFiles();

  const fileFilters: Array<string> = process.argv.length === 3 ?
    [process.argv.pop()!] : ['public/plugin.ts', 'server/plugin.ts'];

  const files: Array<SourceFile> = sourceFiles.filter((v, i) => {
    return fileFilters.find(filter => v.getFilePath().indexOf(filter) >= 0);
  });

  const apis = getContractApi(project, files, plugins);
  console.log(`Collecting references from ${files.length} files...`);

  indexApiReferences(client, apis, commitHash, commitDate, indexAsLatest, false, plugins);
}
