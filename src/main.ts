import './style.css';
import { Shadertoy } from '../lib/Shadertoy'

const app = document.querySelector<HTMLDivElement>('#app')!;
const shadertoy = await Shadertoy.Create( app );
//shadertoy.SetInputMedia( Shadertoy.RENDERPASS.BUFFER_A, 0, '/media/channel1.jpg'); // Set media url as iChannel0
await shadertoy.InitShaderByID( 'NddSWs' );
console.log(shadertoy.renderpasses);
shadertoy.Render();