# Bottom-Bot

Bottom-Bot is a versatile Discord bot built with Bun and Discord.js, offering a wide range of features and customizable commands.

## Features

### Custom Commands

Create and manage custom commands with advanced response capabilities:

- **Basic Replacements**: Use placeholders for user, server, and channel information.
- **Variable Assignment and Usage**: Set and use variables within commands.
- **Random Number Generation**: Generate random numbers within a specified range.
- **Conditional Statements**: Create dynamic responses based on conditions.
- **Choose Function**: Randomly select from a list of options.
- **Permission Checks**: Restrict command usage based on roles or channels.
- **Argument Parsing**: Easily access command arguments.
- **Follow-up Messages**: Send additional messages after the main response.

### Examples
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

- `{set:varName=value}`: Assigns a value to a variable
- `{var:varName}`: Uses the value of a variable

Example:
```
{set:greeting=Hello there!}
{var:greeting} How are you today?
```

#### Random Number Generation

Generate random numbers within a specified range.

- `{random:min-max}`: Generates a random number between min and max (inclusive)

Example:
```
Your lucky number is: {random:1-100}
```

#### Conditional Statements

Use if-else conditions to create dynamic responses.

Syntax:
```
{if:condition}
  Content if true
{else}
  Content if false
{endif}
```

Example:
```
{if:user.hasRole('VIP')}
  Welcome, esteemed VIP member!
{else}
  Welcome, valued member!
{endif}
```

#### Choose Function

Randomly select from a list of options.

Syntax: `{choose:option1;option2;option3}`

Example:
```
Your spirit animal is: {choose:lion;tiger;bear;eagle;wolf}
```

#### Permission Checks

Restrict command usage based on roles or channels.

- `{require:roleName}`: User must have the specified role
- `{require:#channelName}`: Command must be used in the specified channel
- `{require:serverMod}`: User must have the "Manage Guild" permission
- `{not:roleName}`: User must not have the specified role
- `{not:#channelName}`: Command must not be used in the specified channel

Example:
```
{require:VIP}
{not:#general}
This is a special message for VIP members, not in the general channel.
```

#### Argument Parsing

Access command arguments easily.

- `$n`: References the nth argument (1-based index)
- `$n+`: References all arguments from the nth position onwards

Example:
```
First argument: $1
All arguments from the second onwards: $2+
```

#### Follow-up Messages

Send additional messages after the main response.

Syntax: `{followup:message content}`

Example:
```
Welcome to the server!
{followup:Don't forget to read the rules in #rules}
{followup:Enjoy your stay!}
```

#### All together

You can combine these features for more complex commands. Here's an advanced example:

```
{require:Member}
{set:greeting=Welcome}
{if:user.hasRole('VIP')}
  {set:greeting=Greetings, esteemed}
{endif}
{var:greeting} {user.username}!

Your lucky number for today is {random:1-100}.

I hope you enjoy these {choose:funny;interesting;exciting;thought-provoking} facts:
1. $1
2. $2
3. $3

{followup:Thanks for using the fun facts command!}
```

This example combines role checks, variable assignment and usage, conditionals, random number generation, the choose function, argument parsing, and a follow-up message.

Remember, when creating custom commands, you can use these features in various combinations to create engaging and dynamic responses tailored to your server's needs.


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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

This project was created using `bun init` in bun v1.1.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.