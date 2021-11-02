import './style.css';
import { Shadertoy } from '../lib/Shadertoy'

const app = document.querySelector<HTMLDivElement>('#app')!;
const shadertoy = await Shadertoy.Create( app );
//shadertoy.SetInputMedia( Shadertoy.RENDERPASS.BUFFER_A, 1, '/media/channel1.jpg'); // Set media url as iChannel0
await shadertoy.InitShaderByID( 'Ns3XWf' );
console.log(shadertoy);
shadertoy.Render();


//https://www.shadertoy.com/view/ssG3Wt buggy fliped Y coord