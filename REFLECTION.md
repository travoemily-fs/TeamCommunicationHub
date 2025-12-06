# 2.8 Assignment Reflection

<blockqote>How did you handle the complexity of managing multiple chat channels?</blockqote>

<p>Honestly, this was a difficult project to accomplish on many fronts. My project server side was created with a TypeScript base which automatically set me up for some struggles trying to implement the files that were given to us since they were all written with common JS. I had to look through a lot of documentation and forums to clear all the errors and make everything copasetic. It got there, though! And the whole process, as frustrating as it was, helped me understand just how picky the whole TypeScript versus common JS situation really is. Next time, I will be more careful about making sure I initialize my project using the same coding language as the files provided to me to avoid all of the headache. Sometimes it is difficult to keep everything the same when some of the imports are out of date.

My only suggestion for these assignments in the future is providing us an install list with the versions attached so when we start up our projects, we are all using the same versions. I think we did this with last week's assignment and it was a huge help!

One problem that began to arise after I started running client and server sides simultaneously was with the Socket service that poetically reflected the debugging assignment with too many attached event listeners. The useSocket.ts file inside my hooks had listeners but the ConnectionManager file inside the services folder had already ran the constructor when it was imported, way before the socketService.connect() function was ever called. This created a hanging message on the UI: "Connecting..." because listeners were attached to nothing - the ConnectionManager was registering the listeners to a null socket because useSocket was the actual socket.

This is what I ended up doing: in my useSocket.ts file, I removed the socketService.connect() function and replaced the socketService event listeners with the listeners established in the ConnectionManager file. I kept all of the cleanup and return logic the same. Everything inside the ConnectionManager file was left the same. I also had some issues with my logic in the chatDatabase file with the web version not wanting to save messages because of the way I had coded in my SQLite exception.</p>

<blockquote>What was most challenging about implementing user presence across channels?</blockquote>

<p>Answer</p>

<blockquote>How does your offline message handling compare to apps like Slack or Discord?</blockquote>

<p>Answer</p>

<blockquote>What would you improve about the user experience with more time?</blockquote>

<p>Other than the functionality of the app itself, the UI and UX is lacking a bit in my opinion. I would improve the visual aesthetics of the application and make it a bit more user friendly.</p>

<blockquote>How did you ensure consistent real-time behavior across platforms?</blockquote>

<p>Answer</p>
