// Stops a store build that would talk to localhost: WXT_API_URL must be the live Bookbot URL
const url = process.env.WXT_API_URL;
if (!url || !/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) {
  console.error('Set WXT_API_URL in the repo-root .env to your live Bookbot address, e.g. WXT_API_URL=https://app.example.com');
  process.exit(1);
}
