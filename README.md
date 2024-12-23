# Postoad
A tool that lets Discord server admins easily post to Bluesky without sharing the account password.

## Why use Postoad?
To protect the security of your account, you shouldn't share passwords with your team. If you share them, you risk your account being moderated or deleted. Someone posts some bullshit on behalf of YOU and your reputation is in shambles.

## Features
* Manage posts and reply to the community from Discord.
* Automatically post text and media from a Discord channel.
* Like and repost Bluesky posts from Discord.
* Optionally require 2FA and a group password to interact with accounts.

## Security considerations
* Sessions are encrypted with a system key by default, but they can be further secured with a group key. In this case, it means that Da Dragon Den, Beastslash, or any other Postoad server host cannot act on your behalf without knowing your group key.
* If a database breach happens, the malicious actor will only get encrypted sessions.
* Only your guild ID, required channel IDs, authorized user IDs, and encrypted sessions are saved to the database — nothing else.
* If a server administrator forgets their 2FA method or group key, they can only access the Bluesky account by revoking authorization and adding it back to the bot. This protects your social accounts from unauthorized Discord server administrators.
* By default, only server managers can modify bot settings. Permissions can be changed in the Discord integration settings.

## Add Postoad to your server
### Da Dragon Den-managed Postoad
You can add our free instance of Postoad to your server through [our official website](https://postoad.beastslash.com). We try to keep it online as much as possible, but we provide no guarantee on uptime or service availability.

### Self-managed Postoad
You can host Postoad yourself for extra security. Clone this repository, rename `.template.env` to `.env`, and set up your variables. After that, run `npm start` and you're all set.
