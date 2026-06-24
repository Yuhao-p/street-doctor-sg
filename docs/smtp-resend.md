# Reliable auth emails with Resend SMTP

Supabase's built-in email service is rate-limited to a handful of messages per hour
(confirmation + password-reset emails share that quota). That's fine while you keep
**Confirm email OFF** for dev, but for a real launch — where signups and password resets
must actually be delivered — point Supabase at your own SMTP provider.

[Resend](https://resend.com) is a good fit: free tier is **3,000 emails/month / 100 per day**,
which is plenty for a small civic site.

## Prerequisite: a domain you control

Like every transactional email provider, Resend will only send to arbitrary recipients once
you've **verified a sending domain** (so your mail isn't treated as spam). You need a domain
where you can add DNS records, e.g. `streetdoctor.sg` or any cheap domain.

Without a domain you can still test, but Resend will only deliver to your own verified address —
so until you have a domain, just keep **Confirm email OFF** in Supabase.

## Steps

1. **Resend → sign up**, then **Domains → Add Domain**. Add the DNS records it shows (SPF, DKIM,
   and a return-path/MX) at your domain registrar. Wait for it to verify (usually minutes).
2. **Resend → API Keys → Create API Key** (Sending access). Copy the `re_...` key — you only see it once.
3. **Supabase → Authentication → Emails → SMTP Settings** (or Project Settings → Auth → SMTP).
   Enable **custom SMTP** and fill in:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL)  — or `587` for STARTTLS
   - **Username:** `resend`
   - **Password:** your `re_...` API key
   - **Sender email:** something on your verified domain, e.g. `noreply@yourdomain.com`
   - **Sender name:** `Street Doctor SG`
   Save.
4. **Supabase → Authentication → Rate Limits** — now that you're on custom SMTP you can raise
   "Rate limit for sending emails" well above the built-in default.
5. **Turn Confirm email back ON** (Authentication → Providers → Email) and test:
   sign up with a real address and confirm the email arrives; then try **Forgot password**.

## Notes

- The reset-password link still depends on **Authentication → URL Configuration → Redirect URLs**
  containing your site URL (see the main README).
- Resend's dashboard shows a log of every email (delivered / bounced) — handy for debugging.
- Keep the API key secret (it's a sending credential). It lives only in Supabase's SMTP settings,
  never in this repo or the front-end.
