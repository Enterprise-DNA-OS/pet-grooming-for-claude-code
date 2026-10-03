# A grooming record without a front end

A salon's week can be run from a day sheet, client and pet history, rebooking list, care records and a van run ordered by appointment time. This base stores those records in a database and gives the operator commands plus printable HTML documents and read-only views.

It does not provide a phone app, offline synchronisation, drag-and-drop calendar, customer booking portal, photo capture, live maps, route optimisation, automatic messages or payment processing. A van run is a time-ordered visit list, not an optimised route. If field staff need live mobile access, include that interface and its access controls in the implementation before replacing their current workflow.

Enterprise DNA builds the required booking experience, mobile interface and integrations around the owner's records. The database remains theirs. One setup fee, then a retainer through Omni by Enterprise DNA. The free base has no messaging or payment connection to activate accidentally.

Times are explicit UTC. A local-time roster view is a useful first customisation. HTML views contain private contact and care information. Keep them off public hosting. Set your business name, logo and colours in brand.json, run npm run view or npm run docs, then open the files locally or print them.
