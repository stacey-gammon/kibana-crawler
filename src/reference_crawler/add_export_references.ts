import { ReferencedSymbol } from "ts-morph";
import { getApiId } from "../api_crawler/get_api_id";
import { SourceInfo } from "./source_info";
import { BasicPluginInfo, getPluginForPath } from "../plugin_utils";
import { getRelativeKibanaPath } from "../utils";
import { ReferenceDoc } from "./reference_doc";
import { Api } from "../api_utils";
import { apiIndexName } from "../api_crawler/config";

interface Opts {
  referencesForApi: ReferencedSymbol[],
  api: Api,
  sourceInfo: SourceInfo,
  plugins: Array<BasicPluginInfo>,
  allReferences: { [key: string]: ReferenceDoc },
  isStatic: boolean,
  lifeCycle?: string
}

/**
 * Add all references for the given node into refs.
 * 
 * @param nodeRefs
 * @param name 
 * @param sourceInfo 
 * @param plugins 
 * @param refs 
 * @param isStatic 
 * @param lifecycle 
 */
export function addExportReferences({
    referencesForApi,
    api,
    sourceInfo,
    plugins,
    allReferences,
    isStatic
  }: Opts): number {
  let refCnt = 0;
  referencesForApi.forEach(node => {
    node.getReferences().forEach(ref => {
      const docId = `${api.id}.${ref.getSourceFile().getFilePath().replace('/', '')}:${ref.getNode().getStartLineNumber()}`;
      if (allReferences[docId]) {
        return;
      }

      const refPlugin = getPluginForPath(ref.getSourceFile().getFilePath(), plugins);
      if (refPlugin && refPlugin.name !== sourceInfo.sourcePlugin.name) {
        refCnt++;
        allReferences[docId] = ({
          source: {
            id: api.id,
            plugin: sourceInfo.sourcePlugin.name,
            team: sourceInfo.sourcePlugin.teamOwner,
            file: { path: getRelativeKibanaPath(sourceInfo.sourceFile) },
            isStatic,
            lifecycle: api.lifeCycle,
            name,
            xpack: sourceInfo.sourceFile.indexOf("x-pack") >= 0
          },
          reference: {
            team: refPlugin.teamOwner,
            plugin: refPlugin.name,
            file: { path: `${getRelativeKibanaPath(ref.getSourceFile().getFilePath())}:${ref.getNode().getStartLineNumber()}` },
            xpack: sourceInfo.sourceFile.indexOf("x-pack") >= 0
          }
        });
      }
    });
  });
  console.log(`Collected ${refCnt} references for ${api.id}`)
  return refCnt;
}