Original Repository: https://github.com/friedrich-de/yomitan-ultimate-audio/tree/master

I just made a version to work with docker instead of cloudflare, not maintained, not security tested nor battle hardened.

This is meant for a quick jumpstart for spinning up a local Yomitan audio server. Use at your own risk!


## Too lazy to setup?

⚠️ This part is a copy from the original repository of friedrich-de ⚠️:

If you want a no-hassle setup consider signing up for the $1 tier on the Patreon: <https://www.patreon.com/quizmaster/membership>. It saves you the trouble of setting up a Cloudflare and AWS account to enjoy all features. 🙂


## Want to use cloudflare instead?

You'll need this instead: https://github.com/friedrich-de/yomitan-ultimate-audio/tree/master


### Locally

1. Clone the repository

2. Create environment file:
    - `cp config.env.example config.env`
    
    - Configure:
    ```
    AUTHENTICATION_ENABLED=false
    AWS_POLLY_ENABLED=false
    API_KEYS=define_your_own_api_key
    AWS_ACCESS_KEY_ID=your_key
    AWS_SECRET_ACCESS_KEY=your_secret
    ```

3. Add audio data
    - ⚠️ Audio files and database are NOT included in this repository. You must download them separately.

    ⚠️ This part is a copy from the original repository of friedrich-de ⚠️:
    - Download the audio data and put it into the repository folder. [MORE INFO ON DISCORD](https://animecards.site/discord/). (You should have a bunch of folders ending with `_files` in `data`.)

4. Run with Docker:
    - `docker compose up --build`
    - Server runs at: `http://localhost:8787`


5. API Usage (Yomitan)
    - Set your Yomitan Audio Source URL to and set apiKey to the API_KEYS value from config.env:
    `http://localhost:8787/audio/list?term={term}&reading={reading}&apiKey=YOUR_API_KEY`
    - Example: `http://localhost:8787/audio/list?term={term}&reading={reading}&apiKey=m9Nasd12ASdgwer134`

🧠 How it works
1. Yomitan sends term + reading
2. Server queries local SQLite database
3. Matching audio entries are returned
4. Audio is served from:
 - local /data files OR
 - generated via AWS Polly (optional)
5. Response is formatted for Yomitan compatibility

❗ Notes
- This project is a local rewrite of a Cloudflare Worker implementation
- It does not require Wrangler, D1, or R2
- SQLite database must be provided externally
- Audio dataset is distributed via community sources (see Discord)

🧪 Development

Run locally without Docker:
```
npm install
npm run dev
```