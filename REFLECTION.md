# 2.8 Assignment Reflection

<blockquote>How did you handle the complexity of managing multiple chat channels?</blockquote>
<br>
<p>Creating the chatrooms themselves wasn't that difficult once I understood the way they were constructed and conceptualized them like navigation links or routes like we have done in previous projects. Creating that model wasn't as difficult to implement and keep relatively consistent all the way through.</p>

<blockquote>What was most challenging about implementing user presence across channels?</blockquote>
<br>
<p>This was actually one of the easier tasks for me to accomplish because the built-in-rooms that come with Socket.IO and the participant map that made it relatively simple for the acknowledgement of another user being online, but only in the collaborative task section. I couldn't get far enough in the chat rooms to have online user presence available in the chat as I was way too busy trying and failing to figure out why my messages kept spamming. I literally created the debugging assignment myself without needing the problematic files. The only difference is that I was actually able to figure out the issues in that assignment.</p>

<blockquote>How does your offline message handling compare to apps like Slack or Discord?</blockquote>
<br>
<p>I was unable to get my offline messaging to function correctly. They do eventually sync up when going in between rooms in offline mode, but I simply could not get my chatMessages to work in general. Every time the screen was remounted/unmounted, somewhere along the line I didn't code/attach my listeners properly. The real-time flow of my application kept breaking and I couldn't get the messages to appear across platforms - especially in the iOS version. The messages sent from the iOS would eventually appear in the browser when it was offline and in-between the spamming of messages that kept piling up no matter how many times I cleared my local storage cache.</p>

<blockquote>What would you improve about the user experience with more time?</blockquote>
<br>
<p>Other than the functionality of the app itself, the UI and UX is lacking a bit in my opinion. I would improve the visual aesthetics of the application and make it a bit more user friendly.</p>

<blockquote>How did you ensure consistent real-time behavior across platforms?</blockquote>
<br>
<p>I could not get my behavior to be consistent in real time across platforms other than user presence and acknowledging that a user is typing in the chat. Delivery status and offline persistence isn't functional, or at least not as expected. I tried to make my keys unique to avoid the unmounting/remounting viewing it all as new content, however I ran out of time to actually fix it. I kept frantically making changes that at the end of the day, I don't really know what I did. All I can say for sure is restarting the project from fresh probably would've allowed me to solve it because I changed too much to make the current version of my project (in my opinion) worth saving. </p>
