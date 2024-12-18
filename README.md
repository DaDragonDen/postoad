# Postoad
A tool that lets Discord server admins easily post to Bluesky without sharing the account password.

## Why use Postoad?
To protect the security of your account, you shouldn't share passwords with your team. If you share them, you risk your account being moderated or deleted. Someone posts some bullshit on behalf of YOU and your reputation is in shambles.

Postoad uses an app password provided by Bluesky, which restricts the ability to delete your account. It's different from your account password because you can easily revoke it. 

## Features
* Manage posts and reply to the community from Discord.
* Approve posts before they are released.
* Automatically post text and media from a Discord channel.
* Like and repost Bluesky posts from Discord.
* Optionally require 2FA and an administrator password to interact with accounts.

## Security considerations
* Sessions are encrypted with a system password by default, but they can be further secured with an administrator password. In this case, it means that Da Dragon Den, Beastslash, or any other Postoad server host cannot act on your behalf without knowing your administrator password.
* If a database breach happens, the malicious actor will only get encrypted sessions.
* Only your guild ID, required channel IDs, authorized user IDs, and encrypted sessions are saved to the database — nothing else.
* If a server administrator forgets their 2FA method or administrator password, they can only access the Bluesky account by revoking authorization and adding it back to the bot. This protects your social accounts from unauthorized Discord server administrators.
* By default, only server administrators can modify bot settings. Permissions can be changed in the bot's settings.

## Add Postoad to your server
### Da Dragon Den-managed Postoad
You can add our free instance of Postoad to your server through [our official website](https://postoad.beastslash.com). We try to keep it online as much as possible, but we provide no guarantee on uptime or service availability.

### Self-managed Postoad
You can host Postoad yourself for extra security. 

If you want to use the code on this repository as-is, you can install Postoad with the following command:
```
npm install postoad
```

If you don't have a dedicated server host, consider using Render for the server hosting. We're not sponsored by them, but we appreciate that they offer free services for developers. Their "Hobby" tier provides 100 GB outbound bandwidth per month — it should be more than enough for the average person.
