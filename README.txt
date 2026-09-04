POWERGRID V3
============

Τι είναι:
- Ελληνικό web app για iPhone/Android.
- GitHub Pages = εμφάνιση της εφαρμογής.
- Supabase = πραγματικό login + κοινή online βάση.
- Οι εργαζόμενοι δηλώνουν παρουσία, ρεπό, άδεια και υπερωρίες.
- Οι διαχειριστές εγκρίνουν/απορρίπτουν.

ΠΡΟΣΟΧΗ:
Το V3 δεν λειτουργεί online μέχρι να συνδεθεί με το δικό σου Supabase project.

Βήματα:
1. Δημιούργησε δωρεάν project στο Supabase.
2. SQL Editor -> New query -> κάνε paste το supabase_schema.sql -> Run.
3. Authentication -> Users -> δημιούργησε τον πρώτο λογαριασμό διαχειριστή.
4. Στο SQL Editor τρέξε:
   update public.profiles set role='admin', active=true
   where id = (select id from auth.users where email='ΤΟ_EMAIL_ΣΟΥ');
5. Από Project Settings -> API/Connect βρες το Project URL και το public Publishable/Anon key.
6. Βάλε τα δύο στοιχεία στο supabase-config.js.
7. Ανέβασε τα αρχεία στο GitHub repo POWERGRID.
8. Άνοιξε το GitHub Pages link.

ΜΗΝ βάλεις service_role key ή κωδικό Supabase στο supabase-config.js.
