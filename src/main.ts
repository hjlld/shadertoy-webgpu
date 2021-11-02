import './style.css';
import { Shadertoy } from '../lib/Shadertoy'

const app = document.querySelector<HTMLDivElement>('#app')!;
const shadertoy = await Shadertoy.Create( app );
//shadertoy.SetInputMedia( Shadertoy.RENDERPASS.IMAGE, 0, '/media/colorful_noise.png'); // Set media url as iChannel0
await shadertoy.InitShaderByID( 'MdX3zr' );
console.log(shadertoy);
shadertoy.Render();


//https://www.shadertoy.com/view/ssG3Wt buggy fliped Y coord