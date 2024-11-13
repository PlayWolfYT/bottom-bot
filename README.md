# Bottom-Bot

Bottom-Bot is a versatile Discord bot built with Bun and Discord.js, offering a wide range of features and customizable commands.

## Features

### Custom Commands

Create and manage custom commands with advanced response capabilities:

- **Basic Replacements**: Use placeholders for user, server, and channel information.
- **Variable Assignment and Usage**: Set and use variables within commands.
- **Random Number Generation**: Generate random numbers within a specified range.
- **Choose Function**: Randomly select from a list of options.
- **Permission Checks**: Restrict command usage based on roles or channels.
- **Follow-up Messages**: Send additional messages after the main response.
- **Web-Requests**: Make web-requests and use their output for the response.

#### Examples
##### Basic Replacements

These placeholders are replaced with specific information about the user, server, or context.

##### User-related

- `{user.username}`: The username of the command user
- `{user.tag}`: The user's tag (username#discriminator)
- `{user.id}`: The user's Discord ID
- `{user.mention}`: Mentions the user
- `{user.roles}`: Lists the user's roles (excluding @everyone)

Example:
```
Hello {user.username}! Your ID is {user.id}.
```

##### Server-related

- `{server.name}`: The name of the server
- `{server.id}`: The server's Discord ID
- `{server.memberCount}`: The number of members in the server
- `{server.time}`: The current server time

Example:
```
Welcome to {server.name}! We currently have {server.memberCount} members.
```

##### Channel-related

- `{channel.name}`: The name of the current channel
- `{channel.id}`: The ID of the current channel

Example:
```
You're in the #{channel.name} channel.
```

##### Other

- `{client.uptime}`: The bot's uptime
- `{args}`: All command arguments
- `{args[n]}`: A specific argument (n is the index, starting from 0)

Example:
```
The bot has been running for {client.uptime}.
You said: {args}
The first word you said was: {args[0]}
```

##### Variable Assignment and Usage

You can set and use variables within your custom command.

- `{set;varName;value}`: Assigns a value to a variable
- `{varName}`: Uses the value of a variable

Example:
```
{set;greeting;Hello there!}
{greeting} How are you today?
```

##### Random Number Generation

Generate random numbers within a specified range.

- `{random;min;max}`: Generates a random number between min and max (inclusive)

Example:
```
Your lucky number is: {random;1;100}
```

##### Choose Function

Randomly select from a list of options.

Syntax: `{choose;option1;option2;option3}`

Example:
```
Your spirit animal is: {choose;lion;tiger;bear;eagle;wolf}
```

##### Permission Checks

Restrict command usage based on roles or channels.

- `{require;roleName}`: User must have the specified role
- `{require;#channelName}`: Command must be used in the specified channel
- `{require;serverMod}`: User must have the "Manage Guild" permission
- `{not;roleName}`: User must not have the specified role
- `{not;#channelName}`: Command must not be used in the specified channel

Example:
```
{require;VIP}
{not;#general}
This is a special message for VIP members, not in the general channel.
```

##### Follow-up Messages

Send additional messages after the main response.

Syntax: `{followup:message content}`

Example:
```
Welcome to the server!
{followup:Don't forget to read the rules in #rules}
{followup:Enjoy your stay!}
```

##### Web-Requests

Make a web-request to an api and receive its output

Syntax: `{webrequest;outputVariable;URL;requestMethod?;body?}`
Note: The `requestMethod` defaults to `GET`, and the `body` defaults to `null`. Both of those arguments are optional!

Example:
```
{webrequest;dadJoke;https://icanhazdadjoke.com/}
{dadJoke.joke}
```

Advanced Example:
```
{webrequest;counter;https://your-website.com/api/countUsers;POST;\{userId: {user.id} \}}
The new count is {counter}
```
Note: The body is `\{userId: {user.id} \}`. This will be parsed by JSON (which also means you can use " to pass a simple string as the body). 
The `{user.id}` *inside* the body will be replaced by the parser, since it is not escaped.

##### Stickers

Send stickers

Syntax: `{sticker;stickerNameOrId}`

Example:
```
{sticker;lick}
``` 

##### All together

Here is an example, which shows all of those features working together.
```
{require;VIP}
{not;#general}
Welcome, {user.mention} to {server.name}! You're a VIP member, so here's an exclusive joke for you:

{webrequest;dadJoke;https://icanhazdadjoke.com/}
{dadJoke.joke}

{set;theAnswer;42}
The answer to everything is {theAnswer}

Here's a random number between 1 and 100: {random;1;100}

Your lucky color today is: {choose;red;blue;green;yellow}

{followup;https://tenor.com/view/some-random-gif-123456789}
```

### Reminders

Set reminders with natural language processing:
- Use "remind me" in your message to set a reminder.
- The bot understands various time formats and can set reminders accordingly.

### Dad Jokes

The bot has a chance to respond with a dad joke when users say "I'm [something]".

### Server and User Settings

Manage bot settings for your server or personal preferences:
- Set custom prefixes for your server.
- Set timezones for accurate time-based features.

### Ping Command

Check the bot's latency with a simple ping command.

## Installation

To install dependencies:
```bash
bun install
```

## Running the Bot

To run the bot:
```bash
bun run src/index.ts
```


## Environment Variables

Make sure to set the following environment variables:
- `BOT_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Your bot's client ID
- `BOT_PREFIX`: Default prefix for bot commands (optional)

# Bot Triggers
Some commands or other things can send `triggers` to the host system, which allows you to do things *outside* the bots container.

An example for this is the `update` command, which writes the file `./_BOT_TRIGGERS/TRIGGER_UPDATE`, which you can listen to via a simple bash script.

Example:
```bash
#!/bin/bash
while true; do
  if [ -f /home/bottombot/_BOT_TRIGGERS/TRIGGER_UPDATE ]; then
    echo "Bot Update request has been detected. Updating bot"


    # Remove the trigger file to avoid repeated execution
    rm /home/bottombot/_BOT_TRIGGERS/TRIGGER_UPDATE

    # Run the host-side script
    /home/bottombot/update.sh
  fi
  sleep 1  # Check every second
done
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

This project was created using `bun init` in bun v1.1.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.