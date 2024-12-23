import { ComponentTypes, MessageActionRow, SelectMenuBase } from "oceanic.js";
import getHandlePairs from "./get-handle-pairs.js";

export default async function createAccountSelector(guildID: string, customIDPrefix: string, defaultOptionFilter?: (did: string) => boolean, overrides?: Partial<SelectMenuBase<ComponentTypes.STRING_SELECT>>): Promise<MessageActionRow> {

  const handlePairs = await getHandlePairs(guildID);

  return {
    type: ComponentTypes.ACTION_ROW,
    components: [
      {
        type: ComponentTypes.STRING_SELECT,
        customID: `${customIDPrefix}/accountSelector`,
        options: handlePairs.map(([handle, sub]) => ({
          label: handle,
          value: sub,
          description: sub,
          default: defaultOptionFilter ? defaultOptionFilter(sub) : false
        }))
      }
    ]
  }

}