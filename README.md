# Missed Call Assistant - Admin Dashboard

A React admin dashboard for managing the missed call assistant service. View calls, manage businesses, and debug webhook events.

## Features

- 📞 **Recent Calls View** - View call history with transcripts, duration, and status
- 🏪 **Business Management** - Add and edit businesses with phone number configurations
- 🐛 **Debug Panel** - Monitor webhook events and API responses

## Tech Stack

- React 18 with Vite
- React Router for navigation
- Supabase client for database
- Simple CSS styling

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

## Supabase Schema

The dashboard expects the following tables in Supabase:

### businesses
- `id` UUID (primary key)
- `name` VARCHAR(255)
- `phone_number` VARCHAR(20)
- `twilio_number` VARCHAR(20)
- `cal_org_slug` VARCHAR(100)
- `vapi_assistant_id` UUID
- `intake_form_config` JSONB
- `created_at` TIMESTAMP WITH TIME ZONE
- `updated_at` TIMESTAMP WITH TIME ZONE

### calls
- `id` UUID (primary key)
- `business_id` UUID (foreign key to businesses)
- `caller_phone` VARCHAR(20)
- `direction` VARCHAR(10)
- `status` VARCHAR(20)
- `started_at` TIMESTAMP WITH TIME ZONE
- `ended_at` TIMESTAMP WITH TIME ZONE
- `recording_url` TEXT
- `transcript_text` TEXT
- `duration_seconds` INTEGER
- `metadata` JSONB

### webhook_events
- `id` UUID (primary key)
- `source` VARCHAR(50)
- `event_type` VARCHAR(100)
- `payload` JSONB
- `processed` BOOLEAN
- `processed_at` TIMESTAMP WITH TIME ZONE
- `error_message` TEXT
- `created_at` TIMESTAMP WITH TIME ZONE

## Deployment

The app is configured to deploy to Vercel automatically. Connect your GitHub repository to Vercel for zero-config deployment.

## License

MIT
