<div align="center">
    <img width="250" alt="Mentora Logo" src="https://raw.githubusercontent.com/BraHKet/AI-Tutor/refs/heads/versione-con-AItutor/public/logo512.png?token=GHSAT0AAAAAADWAKBXF3JH2HCF7THCBUO4I2NFNTYQ" />
    <h1>Mentora - Full stack project</h1>
<p>An AI system that quizzes you on your exam notes and books, designed for physics, math, and engineering students.</p>

![alt text](https://badgen.net/badge/Status/Archived/yellow?scale=1.5)
</div>

<br>

> [!WARNING]
> **Code Release Status:**
> This work is currently **archived**.
>
> This project was previously deployed on [mentora.im](https://www.mentora.im)
 but is no longer functional. It is no longer maintained, as it did not attract significant public interest. The documentation below is provided for reference only.
> 
---

## Overview

<table>
  <tr>
    <td>
<p>Mentora is a full-stack application I designed to improve individual learning. 

The platform allows students to use their own notes and textbooks as primary sources, enabling an AI tutor to ask questions and assess answers against the content. This approach helps maintain focus on relevant topics while reinforcing understanding.
      


<h3>Key differentiators:</h3>
      
- <b>Multi-modal interaction:</b> Supports both textual and graphical responses, allowing students to draw formulas and graphs that are sent to the AI tutor. The tutor then analyzes both the drawings and the text together, providing feedback and questions based on the combined content, offering a more interactive and personalized study experience than standard LLM chat interfaces.

- <b>Guided questioning:</b> The app actively quizzes the student by asking questions and comparing their answers with the source materials. This transforms studying into an active, personalized learning process, rather than a passive interaction typical of standard LLMs.
</p>
    </td>
    <td>
      <img src="https://i.imgur.com/CVLBX08.jpeg" width="1700" style="border-radius:10px; margin-left:20px;" />
    </td>
  </tr>
</table>
<br>
<p align="center"><img width="900" alt="Mentora" src="https://pbs.twimg.com/media/G1n1qiFXgAABiyo?format=jpg&name=large" /></p>

---

## Tech Stack

- **Frontend:** React  
- **Backend:** Node.js, deployed on Render.com  
- **Database & Auth:** Firebase (Realtime DB, Authentication)  
- **Storage:** Google Drive (free for each user)  
- **LLM AI:** Gemini → OpenAI  
- **Others:** Supabase for database experiments, PDF worker, interactive canvas

---

## Lessons Learned

- Reduce complexity for complex MVPs  
- Validate users before full development  
- Maintain clear separation between frontend, backend, and AI layers  
- Document technical choices and data flow
