import { ReferencedSymbol } from "ts-morph";
import { BasicPluginInfo, getPluginForPath } from "../plugin_utils";
import { SourceInfo } from "./find_references";
import { ReferenceDoc } from "./types";

export function addExportReferences(
  nodeRefs: ReferencedSymbol[],
  name: string,
  sourceInfo: SourceInfo,
  plugins: Array<BasicPluginInfo>,
  refs: { [key: string]: ReferenceDoc },
  isStatic: boolean,
  lifecycle?: string): number {
  let refCnt = 0;  
  const id = lifecycle ?
    `${sourceInfo.sourcePlugin.name}.${sourceInfo.publicOrServer}.${lifecycle}.${name}` :
    `${sourceInfo.sourcePlugin.name}.${sourceInfo.publicOrServer}.${name}`;
  console.log(`Collecting ${nodeRefs.length} references for ${id}`)
  nodeRefs.forEach(node => {
    node.getReferences().forEach(ref => {
      const docId = `${id}.${ref.getSourceFile().getFilePath().replace('/', '')}:${ref.getNode().getStartLineNumber()}`;
      if (refs[docId]) {
        return;
      }

      const refPlugin = getPluginForPath(ref.getSourceFile().getFilePath(), plugins);
      if (refPlugin && refPlugin.name !== sourceInfo.sourcePlugin.name) {
        refCnt++;
        refs[docId] = ({
          source: {
            id,
            plugin: sourceInfo.sourcePlugin.name,
            team: sourceInfo.sourcePlugin.teamOwner,
            file: { path: sourceInfo.sourceFile },
            isStatic,
            lifecycle,
            name,
            xpack: sourceInfo.sourceFile.indexOf("x-pack") >= 0
          },
          reference: {
            team: refPlugin.teamOwner,
            plugin: refPlugin.name,
            file: { path: `${ref.getSourceFile().getFilePath()}:${ref.getNode().getStartLineNumber()}` },
            xpack: sourceInfo.sourceFile.indexOf("x-pack") >= 0
          }
        });
      }
    });
  });

  return refCnt;
}