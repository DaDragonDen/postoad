import Command from "#utils/Command.js";
import addAccountCommand from "./accounts/authorize.js";
const command = new Command({
    name: "accounts",
    description: "Add a Bluesky account with an app password.",
    subCommands: [addAccountCommand]
});
export default command;
//# sourceMappingURL=accounts.js.map